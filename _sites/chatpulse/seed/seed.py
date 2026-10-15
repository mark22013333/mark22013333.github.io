"""把 fixture.json 的虛構展示資料寫進一個全新的 ChatPulse SQLite。

用法（由 run.sh 呼叫，不建議直接跑）：
    CHATPULSE_DATA_DIR=<新目錄> CHATPULSE_DB=<新目錄>/chatpulse.db \
    CHATPULSE_KEY_FILE=<新目錄>/token.key \
    <venv>/bin/python seed.py <ChatPulse repo> <fixture.json> <新目錄>

做法：直接呼叫 ChatPulse 自己的 core.repository 寫入，資料表結構與正式程式完全一致。
安全界線：
- 目標目錄必須是全新的空目錄，而且 DB／金鑰路徑都在它底下；不是就中止。
- 不寫任何 Google 憑證（credentials 表留空），所以伺服器的採集器會跳過這位 Viewer、不連 Google。
- Mention 只寫識別資訊（與正式程式一致，訊息內容本來就不落地）。
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone


def main() -> None:
    repo_dir, fixture_path, work_dir = (os.path.abspath(p) for p in sys.argv[1:4])
    for key in ("CHATPULSE_DATA_DIR", "CHATPULSE_DB", "CHATPULSE_KEY_FILE"):
        val = os.path.abspath(os.environ.get(key, ""))
        if not val.startswith(work_dir + os.sep) and val != work_dir:
            sys.exit(f"中止：{key}={val!r} 不在 {work_dir} 底下")
    if os.path.exists(os.environ["CHATPULSE_DB"]):
        sys.exit("中止：DB 已存在，請換一個全新的目錄（本腳本不覆寫、不刪除）")

    sys.path.insert(0, repo_dir)
    from core import config as cfg  # noqa: E402
    from core import db, directory  # noqa: E402
    from core import repository as repo  # noqa: E402

    assert os.path.abspath(cfg.DB_PATH).startswith(work_dir), cfg.DB_PATH
    assert os.path.abspath(cfg.ENCRYPTION_KEY_FILE).startswith(work_dir), cfg.ENCRYPTION_KEY_FILE

    fx = json.load(open(fixture_path, encoding="utf-8"))
    now = datetime.now(timezone.utc)

    def ago(minutes: float) -> str:
        return (now - timedelta(minutes=minutes)).isoformat(timespec="seconds")

    db.init_db()
    # 在工作目錄產生一把全新的加密金鑰（正式程式是第一次存憑證時才產生；
    # 這裡沒有任何憑證要存，先產生只是讓資料目錄與正式環境同形）
    from core import crypto  # noqa: E402

    crypto._load_or_create_key()
    assert os.path.exists(cfg.ENCRYPTION_KEY_FILE), cfg.ENCRYPTION_KEY_FILE
    v = fx["viewer"]
    viewer = repo.upsert_viewer(v["google_user_id"], v["email"], v["display_name"])
    vid = viewer["id"]
    directory.remember(v["google_user_id"], v["display_name"], source="identity")
    for uid, name in fx["people"].items():
        directory.remember(uid, name, source="identity")

    ids = {}
    for m in fx["mentions"]:
        msg = f"{m['space_id']}/messages/{m['key']}"
        repo.upsert_mention(
            vid,
            {
                "space_id": m["space_id"],
                "space_name": m["space_name"],
                "message_name": msg,
                "thread_name": f"{m['space_id']}/threads/{m['thread']}",
                "sender_name": m["sender"],
                "sender_display": m["sender_display"],
                "create_time": ago(m["minutes_ago"]),
            },
        )
        row = db.query_one(
            "SELECT id FROM mentions WHERE viewer_id = ? AND message_name = ?", (vid, msg)
        )
        ids[m["key"]] = row["id"]
        if m["state"] == "resolved":
            repo.set_mention_state(vid, row["id"], "resolved")

    for s in fx["summaries"]:
        repo.create_summary(
            vid, s["space_id"], s["space_name"], s["style"], s["message_count"], s["content_md"]
        )

    d = fx["draft"]
    gen = json.loads(json.dumps(d["generation_config"]))
    meta = gen.get("meta")
    if meta is not None:
        # 照現行後端寫入的形狀補上執行期才知道的值（server.py:3161-3218）
        target = next(m for m in fx["mentions"] if m["key"] == d["mention_key"])
        mid = ids[d["mention_key"]]
        meta["mention_id"] = mid
        meta["answering"] = [
            {"mention_id": mid, "sender_display": target["sender_display"],
             "create_time": ago(target["minutes_ago"])}
        ]
        # 脈絡＝該串 1 則＋同聊天室其他串在錨點之前的訊息
        msgs = fx["messages"].get(target["space_id"], [])
        used = [m for m in msgs if m["thread"] == target["thread"]] + [
            m for m in msgs
            if m["thread"] != target["thread"] and m["minutes_ago"] > target["minutes_ago"]
        ]
        stamps = sorted(ago(m["minutes_ago"]) for m in used)
        if stamps:
            meta["context"]["time_range"] = {"start": stamps[0], "end": stamps[-1]}
    repo.create_draft(ids[d["mention_key"]], d["content_md"], gen)

    c = fx["collector"]
    repo.set_collector_state(
        vid, last_polled_at=ago(c["polled_minutes_ago"]), last_run_stats=c["stats"]
    )

    token = repo.create_session(vid)
    with open(os.path.join(work_dir, "session.txt"), "w") as f:
        f.write(token)
    with open(os.path.join(work_dir, "mention_ids.json"), "w") as f:
        json.dump(ids, f)
    print(f"seed 完成：viewer={vid} mentions={len(ids)} summaries={len(fx['summaries'])}")
    print(f"DB={cfg.DB_PATH}")


if __name__ == "__main__":
    main()
