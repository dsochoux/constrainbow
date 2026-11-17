"""Danny's analytics dashboard, at /dashboard.

On the server, nginx asks for a password before passing /dashboard on, and marks those requests with
the header X-Dashboard-Auth: passed (it clears that header on every other request, so a visitor can't
fake it). Anything that came through nginx without it gets a 404, so a missing nginx setup fails
closed. Running locally (python project/app.py, no nginx) it opens without a password, like
/review-words. The nginx part is in server/nginx-dashboard.conf.

It reads two kinds of logs:
  - logs/events/YYYY-MM-DD.jsonl: visits, starts, finishes, shares, SHOW BEST and reports, each with an
    anonymous player id (since 2026-11-16; see /log-event in app.py)
  - logs/MMDDYYYY/{solve,speed,score}.csv: every first solve, back to Feb 2025
"""
import csv
import json
import os
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from flask import Blueprint, abort, render_template, request

eastern = ZoneInfo("America/New_York")
EVENTS_FOLDER = "./logs/events/"
MODES = ("solve", "speed", "score")
RANGES = (7, 30, 90)

dashboard = Blueprint("dashboard", __name__)


@dashboard.before_request
def only_danny():
    if "X-Forwarded-For" not in request.headers:
        # no nginx in front: only allow this computer (running locally)
        if request.remote_addr not in ("127.0.0.1", "::1"):
            abort(404)
    elif request.headers.get("X-Dashboard-Auth") != "passed":
        abort(404)


# ---- reading the logs ----

def load_events(first_day, last_day):
    """every event from first_day to last_day (dates), each with its "date" added"""
    events = []
    day = first_day
    while day <= last_day:
        path = f"{EVENTS_FOLDER}{day:%Y-%m-%d}.jsonl"
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    try:
                        event = json.loads(line)
                    except ValueError:
                        continue
                    event["date"] = day
                    events.append(event)
        day += timedelta(days=1)
    return events


def load_solves(mode, day):
    """the first solves logged for one day and mode (the CSVs), as dicts"""
    path = f"./logs/{day:%m%d%Y}/{mode}.csv"
    if not os.path.exists(path):
        return []
    with open(path, "r", newline="") as f:
        return list(csv.DictReader(f))


def load_puzzle(mode, day):
    path = f"./games/{mode}/{day:%m%d%Y}.json"
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def seconds_of(metric):
    """'1:02' or '1:02:03' -> seconds"""
    seconds = 0
    for part in metric.split(":"):
        seconds = seconds * 60 + int(part)
    return seconds


def format_seconds(seconds):
    if seconds is None:
        return "–"
    seconds = int(round(seconds))
    return f"{seconds // 60}:{seconds % 60:02d}"


def median(values):
    return statistics.median(values) if values else None


# ---- the numbers ----

def overview(events):
    visits = [e for e in events if e["event"] == "visit"]
    players = {e["player"] for e in visits}
    days_by_player = defaultdict(set)
    for e in visits:
        days_by_player[e["player"]].add(e["date"])
    finishes = [e for e in events if e["event"] == "finish"]
    return [
        ("Visitors", len(players), "different browsers that opened a page"),
        ("New", len({e["player"] for e in visits if e.get("new")}), "first visit ever"),
        ("Came back", sum(1 for days in days_by_player.values() if len(days) >= 2), "visited on 2+ days"),
        ("Finishes", len(finishes), "puzzles finished (archive included)"),
        ("Shares", sum(1 for e in events if e["event"] == "share"), "COPY RESULTS clicks"),
        ("Archive plays", sum(1 for e in finishes if e.get("archive")), "past puzzles finished"),
    ]


def daily_rows(first_day, last_day, events):
    """one row per day: visitors (new / returning) from events, finishes per mode from the CSVs"""
    visits_by_day = defaultdict(dict)  # day -> player -> is new
    for e in events:
        if e["event"] == "visit":
            visits_by_day[e["date"]][e["player"]] = visits_by_day[e["date"]].get(e["player"], False) or e.get("new", False)
    rows = []
    day = first_day
    while day <= last_day:
        players = visits_by_day.get(day, {})
        finishes = {mode: len(load_solves(mode, day)) for mode in MODES}
        rows.append({
            "day": day,
            "visitors": len(players) if day in visits_by_day else None,
            "new": sum(1 for is_new in players.values() if is_new),
            "finishes": finishes,
            "total_finishes": sum(finishes.values()),
        })
        day += timedelta(days=1)
    return rows


def funnels(events):
    """per mode, the daily puzzles only (no archive): for visited, started, finished and shared, the
    plays (one per player per day) and the different players"""
    rows = []
    for mode in MODES:
        def plays(event_name):
            return {(e["player"], e["date"]) for e in events
                    if e["event"] == event_name and e["mode"] == mode and not e.get("archive")}
        row = {"mode": mode}
        # score has no START button: its "start" is the first letter typed
        for column, event_name in (("visited", "visit"), ("started", "start"), ("finished", "finish"), ("shared", "share")):
            found = plays(event_name)
            row[column] = (len(found), len({player for player, _ in found}))
        # of the days someone opened the day's puzzle, how often they finished it
        row["finish_rate"] = f"{row['finished'][0] / row['visited'][0]:.0%}" if row["visited"][0] else "–"
        rows.append(row)
    return rows


def sources(events):
    visits = [e for e in events if e["event"] == "visit"]
    first_visit = {}
    for e in visits:
        first_visit.setdefault(e["player"], e)
    referrers = Counter((e.get("ref") or "direct / bookmark") for e in first_visit.values())
    utms = Counter(e.get("utm") for e in first_visit.values() if e.get("utm"))
    devices = Counter(e.get("device", "?") for e in first_visit.values())
    return referrers.most_common(10), utms.most_common(10), devices.most_common()


def day_details(day):
    """for one day, per mode: the puzzle, its submissions, and a summary of the results"""
    details = []
    for mode in MODES:
        solves = load_solves(mode, day)
        puzzle = load_puzzle(mode, day) or {}
        summary = []
        if mode == "solve":
            times = [int(s["seconds"]) for s in solves if s.get("seconds", "").isdigit()]
            reveals = [int(s["revealed_tiles"]) for s in solves if s.get("revealed_tiles", "").isdigit()]
            summary = [("Solves", len(solves)), ("Median time", format_seconds(median(times))),
                       ("Fastest", format_seconds(min(times)) if times else "–"),
                       ("Avg reveals", f"{sum(reveals) / len(reveals):.1f}" if reveals else "–"),
                       ("No reveals", f"{sum(1 for r in reveals if r == 0)}/{len(reveals)}" if reveals else "–")]
            rows = [(s.get("time", ""), s.get("tester", ""), format_seconds(int(s["seconds"])) if s.get("seconds", "").isdigit() else "",
                     f"{s.get('revealed_tiles', '')} reveals", " ".join(s.get(f"word{i}", "") for i in range(4)).upper())
                    for s in solves]
        elif mode == "speed":
            times = [seconds_of(s["metric"]) for s in solves if s.get("metric")]
            summary = [("Solves", len(solves)), ("Median time", format_seconds(median(times))),
                       ("Fastest", format_seconds(min(times)) if times else "–"),
                       ("Solutions", f"{puzzle.get('num_possible_solutions', 0):,}")]
            rows = [(s.get("time", ""), "", s.get("metric", ""), "", " ".join(s.get(f"word{i}", "") for i in range(4)).upper())
                    for s in solves]
        else:
            points = [int(s["metric"].split("/")[0]) for s in solves if "/" in s.get("metric", "")]
            best = puzzle.get("num_possible_points")
            summary = [("Solves", len(solves)), ("Max possible", best or "–"),
                       ("Best submitted", max(points) if points else "–"),
                       ("Avg % of max", f"{sum(points) / len(points) / best:.0%}" if points and best else "–")]
            rows = [(s.get("time", ""), "", s.get("metric", ""), "", " ".join(s.get(f"word{i}", "") for i in range(4)).upper())
                    for s in solves]
        answer = " ".join(puzzle.get("solution", [])).upper() if mode == "solve" else ""
        details.append({"mode": mode, "summary": summary, "rows": rows, "answer": answer,
                        "clue": puzzle.get("clue", "")})
    return details


def solve_puzzles(last_day, count=14):
    """recent SOLVE days: the generator's difficulty estimate next to how players actually did"""
    rows = []
    for i in range(count):
        day = last_day - timedelta(days=i)
        puzzle = load_puzzle("solve", day)
        if puzzle is None:
            continue
        solves = load_solves("solve", day)
        times = [int(s["seconds"]) for s in solves if s.get("seconds", "").isdigit()]
        reveals = [int(s["revealed_tiles"]) for s in solves if s.get("revealed_tiles", "").isdigit()]
        rows.append({
            "day": day,
            "answer": " ".join(puzzle["solution"]).upper(),
            "theme": puzzle.get("clue") or ("theme" if puzzle.get("theme") else ""),
            "estimate": puzzle.get("difficulty", {}).get("remaining"),
            "solves": len(solves),
            "median": format_seconds(median(times)),
            "reveals": f"{sum(reveals) / len(reveals):.1f}" if reveals else "–",
        })
    return rows


def pending_reports():
    def words_in(path):
        if not os.path.exists(path):
            return set()
        with open(path, "r") as f:
            return {line.strip() for line in f if line.strip()}
    reported = words_in("./word_files/reported_missing_words.txt")
    return len(reported - words_in("./word_files/words.txt") - words_in("./word_files/rejected_words.txt"))


@dashboard.route("/dashboard")
def dashboard_page():
    today = datetime.now(eastern).date()
    try:
        days = int(request.args.get("range", "30"))
    except ValueError:
        days = 30
    days = days if days in RANGES else 30
    try:
        day = datetime.strptime(request.args.get("day", ""), "%Y-%m-%d").date()
    except ValueError:
        day = today
    day = min(day, today)
    first_day = today - timedelta(days=days - 1)
    events = load_events(first_day, today)
    rows = daily_rows(first_day, today, events)
    most = max([1] + [max(r["visitors"] or 0, r["total_finishes"]) for r in rows])
    referrers, utms, devices = sources(events)
    return render_template(
        "dashboard.html",
        today=today, days=days, ranges=RANGES, day=day,
        previous_day=day - timedelta(days=1), next_day=day + timedelta(days=1) if day < today else None,
        overview=overview(events), daily=rows, most=most,
        funnels=funnels(events), referrers=referrers, utms=utms, devices=devices,
        details=day_details(day), solve_rows=solve_puzzles(today), pending_reports=pending_reports(),
        events_since=min((e["date"] for e in events), default=None),
    )
