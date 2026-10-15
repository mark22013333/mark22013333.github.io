"""FamilyReward 作品介紹頁截圖用的虛構資料。

每次執行都在 --work 底下建立一個全新的 run-<時間戳>/ 目錄，裡面放：
  config.yaml        指向本目錄的 SQLite／log／backup（絕不碰專案的 data/）
  family-reward.db   全新的空資料庫，跑完 migration 後灌入虛構資料

用法（在 FamilyReward 的 venv 裡執行）：
  python seed.py seed  --src <FamilyReward clone> --work <暫存目錄>
  python seed.py serve --src <FamilyReward clone> --run <seed 印出的 run 目錄> --port 8811

全部資料皆為虛構：範例家庭、小明、小美；家長帳號 demo-parent。
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

ADMIN_USER = "demo-parent"
ADMIN_INITIAL_PW = "demo-initial-pw"
ADMIN_PW = "demo-parent-pw"
SECRET = "demo-only-secret-key-not-used-anywhere-else-0123456789"

CONFIG_TEMPLATE = """\
server:
  host: "127.0.0.1"
  port: {port}
  threads: 4
app:
  name: "家庭任務集點樂園"
  timezone: "Asia/Taipei"
  debug: false
  env: "development"
database:
  path: "{run}/family-reward.db"
reward:
  points_per_card: 10
  allow_negative_balance: false
security:
  session_timeout_hours: 12
  child_pin_length: 4
  max_login_attempts: 5
  lockout_minutes: 5
admin:
  initial_username: "{admin}"
cloudflare:
  enabled: false
  executable: "{run}/no-cloudflared"
  config: "{run}/no-cloudflare.yml"
  hostname: ""
logging:
  path: "{run}/logs/family-reward.log"
  level: "INFO"
  max_bytes: 1048576
  backup_count: 1
backup:
  directory: "{run}/backup"
  reminder_days: 7
ui:
  sound_enabled: false
"""


def _prepare_env(src: Path, config: Path) -> None:
    # 外部服務一律不連；設定只從 run 目錄讀。
    for key in list(os.environ):
        if key.endswith("_API_KEY") or key.startswith("GOOGLE_") or key.startswith("CF_"):
            os.environ.pop(key, None)
    os.environ["FAMILY_REWARD_CONFIG"] = str(config)
    os.environ["FLASK_SECRET_KEY"] = SECRET
    os.environ["ADMIN_INITIAL_PASSWORD"] = ADMIN_INITIAL_PW
    os.environ["APP_ENV"] = "development"
    if (src / ".env").exists():
        raise SystemExit(f"{src}/.env 存在，為避免讀到真實設定，拒絕執行。")
    sys.path.insert(0, str(src))


def cmd_seed(args: argparse.Namespace) -> None:
    src = Path(args.src).resolve()
    work = Path(args.work).resolve()
    run = work / ("run-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    run.mkdir(parents=True, exist_ok=False)
    (run / "logs").mkdir()
    (run / "backup").mkdir()
    config = run / "config.yaml"
    config.write_text(
        CONFIG_TEMPLATE.format(port=args.port, run=run.as_posix(), admin=ADMIN_USER),
        encoding="utf-8",
    )
    _prepare_env(src, config)

    from flask_migrate import upgrade

    from family_reward import create_app
    from family_reward.extensions import db
    from family_reward.models import Theme
    from family_reward.seed import initialize
    from family_reward.services import (
        admin_service,
        assignment_service,
        backup_service,
        child_service,
        point_service,
        redemption_service,
        reward_service,
        task_service,
    )
    from family_reward.utils.timezone import today_local

    app = create_app()
    assert str(app.settings.database.path).startswith(str(run)), "DB 路徑不在 run 目錄"
    with app.app_context():
        upgrade()
    initialize(app)

    with app.app_context():
        admin = admin_service.get_by_username(ADMIN_USER)
        admin_service.change_password(admin, ADMIN_INITIAL_PW, ADMIN_PW, ADMIN_PW)
        aid, aname = admin.id, admin.username

        ming = child_service.create_child(
            name="小明", pin="1234", avatar="🐼",
            theme=Theme.SUNNY.value, admin_id=aid, admin_name=aname,
        )
        mei = child_service.create_child(
            name="小美", pin="5678", avatar="🐰",
            theme=Theme.CANDY.value, admin_id=aid, admin_name=aname,
        )
        both = [ming.id, mei.id]
        tasks = [
            ("刷牙", "🪥", 1, "HYGIENE", True, both),
            ("寫功課", "📚", 2, "HOMEWORK", True, both),
            ("整理玩具", "🧸", 2, "HOUSEWORK", False, both),
            ("洗澡", "🚿", 1, "HYGIENE", True, both),
            ("閱讀 20 分鐘", "📖", 2, "HABIT", False, both),
        ]
        for title, icon, pts, cat, req, kids in tasks:
            task_service.create_task(
                title=title, icon=icon, points=pts, category=cat, required=req,
                child_ids=kids, admin_id=aid, admin_name=aname,
            )
        rewards = [
            ("吃冰淇淋", "🍦", 10, None),
            ("玩遊戲 30 分鐘", "🎮", 10, None),
            ("選今晚看的電影", "🍿", 15, None),
            ("小積木組", "🧱", 30, 1),
        ]
        for name, icon, pts, qty in rewards:
            reward_service.create_reward(
                name=name, icon=icon, points_required=pts, quantity=qty,
                admin_id=aid, admin_name=aname,
            )

        today = today_local(app.settings.app.timezone)
        children = {c.id: c for c in child_service.list_children()}

        # 過去 13 天：大多數任務完成並批准（小美少做幾項，讓行事曆有深淺）。
        for back in range(13, 0, -1):
            day = today - timedelta(days=back)
            for cid, child in children.items():
                items = assignment_service.ensure_assignments_for_date(cid, day)
                for i, a in enumerate(items):
                    skip = (cid == mei.id and (back + i) % 4 == 0) or (back == 1 and i >= 3)
                    if skip or (back == 5 and cid == ming.id):
                        continue
                    assignment_service.submit_assignment(a.id, child, today=day)
                    assignment_service.approve_assignment(a.id, aid, aname)

        # 今天：小明完成 2 項已批准、2 項等家長確認；小美 1 項等確認。
        for cid, child in children.items():
            items = assignment_service.ensure_assignments_for_date(cid, today)
            if cid == ming.id:
                for a in items[:2]:
                    assignment_service.submit_assignment(a.id, child, today=today)
                    assignment_service.approve_assignment(a.id, aid, aname)
                for a in items[2:4]:
                    assignment_service.submit_assignment(a.id, child, today=today)
            else:
                assignment_service.submit_assignment(items[1].id, child, today=today)

        point_service.adjust_points(
            child_id=mei.id, points=3, reason="主動幫忙收碗筷", admin_id=aid, admin_name=aname,
        )

        rid = {r.name: r.id for r in reward_service.list_rewards()}
        r1 = redemption_service.request_redemption(children[ming.id], rid["吃冰淇淋"])
        redemption_service.approve_redemption(r1.id, aid, aname)
        redemption_service.request_redemption(children[mei.id], rid["玩遊戲 30 分鐘"])

        # 慶祝通知只播一次：歷史的都標為已讀，只留小明最新一則，讓「今天」頁看得到慶祝卡。
        from family_reward.models import Notification
        notes = db.session.execute(
            db.select(Notification).order_by(Notification.id.desc())
        ).scalars().all()
        keep = next((n.id for n in notes if n.child_id == ming.id), None)
        now = datetime.utcnow()
        for n in notes:
            if n.id != keep:
                n.read_at = now
        db.session.commit()

        backup_service.create_backup(
            app.settings.database.path, app.settings.backup.directory,
            tz_name=app.settings.app.timezone,
        )
        db.session.remove()

    print(run)


def cmd_serve(args: argparse.Namespace) -> None:
    src = Path(args.src).resolve()
    run = Path(args.run).resolve()
    config = run / "config.yaml"
    text = config.read_text(encoding="utf-8")
    import re

    config.write_text(re.sub(r"port: \d+", f"port: {args.port}", text, count=1), encoding="utf-8")
    _prepare_env(src, config)

    from waitress import serve

    from family_reward import create_app

    app = create_app()
    assert str(app.settings.database.path).startswith(str(run)), "DB 路徑不在 run 目錄"
    serve(app, host="127.0.0.1", port=args.port, threads=4)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_seed = sub.add_parser("seed")
    p_seed.add_argument("--src", required=True)
    p_seed.add_argument("--work", required=True)
    p_seed.add_argument("--port", type=int, default=8811)
    p_seed.set_defaults(func=cmd_seed)
    p_serve = sub.add_parser("serve")
    p_serve.add_argument("--src", required=True)
    p_serve.add_argument("--run", required=True)
    p_serve.add_argument("--port", type=int, default=8811)
    p_serve.set_defaults(func=cmd_serve)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
