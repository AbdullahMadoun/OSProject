from scripts.visualize_runs import build_html_report, load_rows
from scripts.visualize_runs import summarize_by_algo


def test_load_rows_parses_numeric_fields(tmp_path):
    csv_path = tmp_path / "runs.csv"
    csv_path.write_text(
        "algo,n_procs,avg_burst,std_burst,avg_arrival_gap,max_priority,quantum,"
        "ctx_overhead,avg_waiting,avg_turnaround,avg_response,cpu_utilization,"
        "throughput,context_switches\n"
        "fcfs,4,5.5,1.2,1.0,3,0,0,10.0,15.0,10.0,1.0,0.12,0\n",
        encoding="utf-8",
    )

    rows = load_rows(str(csv_path))

    assert rows[0]["n_procs"] == 4
    assert rows[0]["avg_waiting"] == 10.0
    assert rows[0]["context_switches"] == 0


def test_summarize_by_algo_averages_multiple_rows():
    rows = [
        {
            "algo": "fcfs",
            "avg_waiting": 10.0,
            "avg_turnaround": 15.0,
            "avg_response": 10.0,
            "cpu_utilization": 1.0,
            "throughput": 0.1,
            "context_switches": 0,
        },
        {
            "algo": "fcfs",
            "avg_waiting": 14.0,
            "avg_turnaround": 20.0,
            "avg_response": 14.0,
            "cpu_utilization": 0.8,
            "throughput": 0.2,
            "context_switches": 2,
        },
    ]

    summary = summarize_by_algo(rows)

    assert len(summary) == 1
    assert summary[0]["algo"] == "fcfs"
    assert summary[0]["runs"] == 2
    assert summary[0]["avg_waiting"] == 12.0
    assert summary[0]["context_switches"] == 1.0


def test_build_html_report_contains_dashboard_sections():
    rows = [
        {
            "algo": "fcfs",
            "avg_waiting": 10.0,
            "avg_turnaround": 15.0,
            "avg_response": 10.0,
            "cpu_utilization": 1.0,
            "throughput": 0.1,
            "context_switches": 0,
        },
        {
            "algo": "sjf",
            "avg_waiting": 8.0,
            "avg_turnaround": 12.0,
            "avg_response": 8.0,
            "cpu_utilization": 1.0,
            "throughput": 0.1,
            "context_switches": 0,
        },
    ]

    report = build_html_report(rows, "runs.csv")

    assert "CPU Scheduling Results Dashboard" in report
    assert "Average Metrics By Algorithm" in report
    assert "Latest Row Per Algorithm" in report
    assert "FCFS" in report
    assert "SJF" in report
