#!/usr/bin/env python3
"""Audit original contracts without treating analog counts as equivalence."""
import argparse, csv, io, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def render_csv(rows):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()

def reports():
    candidates = list(csv.DictReader((ROOT / "spec/Domain_Node_Provider_Catalog.csv").open()))
    decisions = list(csv.DictReader((ROOT / "spec/Decision_Register_125.csv").open()))
    evidence = json.loads((ROOT / "tools/contract-evidence.json").read_text())
    if set(evidence) != {r["node_type_id"] for r in candidates}:
        raise ValueError("Contract evidence must cover the exact original catalog")
    program = """import {GraphEditorModel,EDITABLE_NODE_TYPES} from './src/editor/model.mjs';
const m=new GraphEditorModel({registry:{}});m.newGraph('Port inventory');const r={};
for(const t of EDITABLE_NODE_TYPES){m.addNode(t.id);r[t.id]=m.selectedNode.ports;}
console.log(JSON.stringify(r));"""
    run = subprocess.run(["node", "--input-type=module", "-e", program], cwd=ROOT, text=True, capture_output=True, check=True)
    actual = json.loads(run.stdout)
    rows = []
    for candidate in candidates:
        key = candidate["node_type_id"]
        item = evidence[key]
        if item["status"] not in {"local-contract-tests", "review-needed"}:
            raise ValueError("Unknown evidence status: " + key)
        for file in item["runtime_sources"] + item["test_sources"]:
            path = (ROOT / file).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                raise ValueError("Invalid evidence pointer: " + file)
        if any(t not in actual for t in item["engine_nodes"]):
            raise ValueError("Mapped node is not implemented in the editor: " + key)
        ports = {t: actual[t] for t in item["engine_nodes"]}
        rows.append({"candidate": key, "source_adrs": candidate["required_source_adrs"],
            "role": candidate["node_role"], "proposed_ports": candidate["port_signature"],
            "engine_nodes": ";".join(item["engine_nodes"]), "actual_default_ports": json.dumps(ports, sort_keys=True, separators=(",", ":")),
            "status": item["status"], "assessment": item["assessment"],
            "runtime_sources": ";".join(item["runtime_sources"]), "test_sources": ";".join(item["test_sources"]),
            "foundry_validation": "not-run"})
    decision_rows = []
    test_texts = {str(p.relative_to(ROOT)): p.read_text() for p in (ROOT / "tests").glob("*.test.mjs")}
    for decision in decisions:
        adr = decision["decision_id"]
        related = [r for r in rows if adr in r["source_adrs"].split(";")]
        explicit = [p for p, text in test_texts.items() if re.search(r"(?<![A-Z0-9-])" + re.escape(adr) + r"(?![0-9])", text)]
        decision_rows.append({"decision_id": adr, "topic": decision["topic"], "requirement_ids": decision["requirement_ids"],
            "proposed_acceptance_id": decision["decision_test_id"], "related_candidates": ";".join(r["candidate"] for r in related),
            "related_contracts_awaiting_review": sum(r["status"] != "local-contract-tests" for r in related),
            "explicit_local_test_references": ";".join(explicit),
            "local_evidence_status": "targeted-test-reference" if explicit else "targeted-scenario-evidence-needed",
            "foundry_validation": "not-run", "completion_claim": "not-certified"})
    return {"docs/NODE_CONTRACT_AUDIT.csv": render_csv(rows), "docs/DECISION_TRACEABILITY.csv": render_csv(decision_rows)}, rows, decision_rows, actual

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Reject stale generated reports without modifying files")
    args = parser.parse_args()
    outputs, rows, decisions, actual = reports()
    for name, content in outputs.items():
        path = ROOT / name
        if args.check:
            if not path.is_file() or path.read_text() != content:
                raise SystemExit("Stale report: " + name + "; run npm run coverage:report")
        else:
            path.write_text(content)
    print(f"PASS: traceability inventory for {len(rows)} candidate contracts and {len(decisions)} decisions; {len(actual)} editor node types")
    print("Local contract-test mappings:", sum(r["status"] == "local-contract-tests" for r in rows))
    print("Original catalog mappings requiring a separate semantic disposition (see SEMANTIC_CONTRACT_TRACE.csv):", sum(r["status"] != "local-contract-tests" for r in rows))
    print("Missing-feature count: not determined by this inventory.")
    print("Inventory validation is not a feature-completeness or Foundry certification.")

if __name__ == "__main__":
    main()
