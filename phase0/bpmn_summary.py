"""Summarise Activiti BPMN files: tasks, assignment, forms, gateways, call activities, multi-instance, listeners.

Usage: python bpmn_summary.py <dir-with-bpmn20.xml> > summary.txt
Also writes <key>.mmd (Mermaid flowchart) next to each BPMN file.
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"b": "http://www.omg.org/spec/BPMN/20100524/MODEL", "a": "http://activiti.org/bpmn"}
A = "{http://activiti.org/bpmn}"


def local(tag):
    return tag.split("}")[-1]


def text(el):
    return (el.text or "").strip() if el is not None else ""


def attrs(el):
    return {local(k) if "}" in k else k: v for k, v in el.attrib.items()}


def label(el):
    name = (el.get("name") or "").replace("\n", " ").strip()
    return name or el.get("id") or local(el.tag)


def mermaid_id(i):
    return re.sub(r"[^A-Za-z0-9_]", "_", i)


def summarize(path):
    root = ET.parse(path).getroot()
    out = []
    for proc in root.findall("b:process", NS):
        pid = proc.get("id")
        out.append(f"\n################ PROCESS {pid} – {proc.get('name')}")
        nodes = {}
        flows = []

        def walk(container, depth=0):
            for el in container:
                t = local(el.tag)
                if t in ("sequenceFlow",):
                    cond = el.find("b:conditionExpression", NS)
                    flows.append((el.get("sourceRef"), el.get("targetRef"), label(el) if el.get("name") else "",
                                  re.sub(r"\s+", " ", text(cond)).replace("<![CDATA[", "").replace("]]>", "")))
                    continue
                if t in ("extensionElements", "documentation", "laneSet", "dataObject", "textAnnotation", "association") or not el.get("id"):
                    continue
                nodes[el.get("id")] = (t, el, depth)
                if t in ("subProcess", "transaction"):
                    walk(el, depth + 1)

        walk(proc)
        for nid, (t, el, depth) in nodes.items():
            pad = "  " * depth
            a = attrs(el)
            line = f"{pad}- [{t}] {nid} \"{label(el)}\""
            extras = []
            for k in ("assignee", "candidateUsers", "candidateGroups", "formKey", "dueDate", "priority", "class",
                      "expression", "delegateExpression", "calledElement", "async", "default", "attachedToRef",
                      "cancelActivity"):
                if k in a:
                    extras.append(f"{k}={a[k]}")
            mi = el.find("b:multiInstanceLoopCharacteristics", NS)
            if mi is not None:
                ma = attrs(mi)
                cc = text(mi.find("b:completionCondition", NS))
                extras.append(f"MULTI(seq={ma.get('isSequential')}, collection={ma.get('collection')}, elem={ma.get('elementVariable')}, completion={cc})")
            for ev in el:
                et = local(ev.tag)
                if et.endswith("EventDefinition"):
                    detail = " ".join(f"{local(c.tag)}={text(c)}" for c in ev) or ev.get("errorRef", "")
                    extras.append(f"{et}{(':' + detail) if detail else ''}")
            ext = el.find("b:extensionElements", NS)
            if ext is not None:
                for c in ext:
                    ct = local(c.tag)
                    ca = attrs(c)
                    if ct in ("taskListener", "executionListener"):
                        extras.append(f"{ct}({ca.get('event')}:{ca.get('class') or ca.get('expression') or ca.get('delegateExpression')})")
                    elif ct == "formProperty":
                        pass
                    elif ct in ("in", "out"):
                        extras.append(f"{ct}({ca.get('source') or ca.get('sourceExpression')}->{ca.get('target')})")
                    elif ct == "field":
                        val = text(c.find(f"{A}string")) or text(c.find(f"{A}expression")) or ca.get("stringValue") or ca.get("expression")
                        extras.append(f"field({ca.get('name')}={val})")
                fps = [attrs(c) for c in ext if local(c.tag) == "formProperty"]
                if fps:
                    extras.append("formProps[" + ", ".join(f"{p.get('id')}:{p.get('type','')}{'*' if p.get('required') == 'true' else ''}" for p in fps[:12]) + (" …" if len(fps) > 12 else "") + f"] ({len(fps)})")
            doc = text(el.find("b:documentation", NS))
            if doc:
                extras.append(f"doc={doc[:120]!r}")
            out.append(line + ("\n" + pad + "    " + "\n" + pad + "    ".join(extras) if extras else ""))
        out.append("  FLOWS:")
        for s, t, n, c in flows:
            out.append(f"    {s} -> {t}" + (f" [{n}]" if n else "") + (f"  if {c}" if c else ""))

        # Mermaid
        mm = ["flowchart LR"]
        shape = {"startEvent": ("((", "))"), "endEvent": ("(((", ")))"), "exclusiveGateway": ("{", "}"),
                 "parallelGateway": ("{{", "}}"), "inclusiveGateway": ("{", "}"), "callActivity": ("[[", "]]"),
                 "serviceTask": ("[/", "/]"), "boundaryEvent": ("((", "))")}
        for nid, (t, el, depth) in nodes.items():
            if t in ("subProcess", "transaction"):
                continue
            l, r = shape.get(t, ("[", "]"))
            name = label(el).replace('"', "'")
            if t == "callActivity":
                name += f" → {el.get('calledElement')}"
            if el.find("b:multiInstanceLoopCharacteristics", NS) is not None:
                name += " ⫴"
            mm.append(f'  {mermaid_id(nid)}{l}"{name}"{r}')
        for s, t, n, c in flows:
            lab = n or (re.sub(r"\$\{|\}", "", c)[:40] if c else "")
            lab = lab.replace('"', "'").replace("|", "/")
            mm.append(f"  {mermaid_id(s)} -->" + (f'|"{lab}"|' if lab else "") + f" {mermaid_id(t)}")
        for nid, (t, el, depth) in nodes.items():
            if t == "boundaryEvent":
                mm.append(f"  {mermaid_id(el.get('attachedToRef'))} -.- {mermaid_id(nid)}")
        Path(path).with_suffix("").with_suffix(".mmd").write_text("\n".join(mm), encoding="utf-8")
    return "\n".join(out)


if __name__ == "__main__":
    folder = Path(sys.argv[1])
    report = "\n".join(summarize(f) for f in sorted(folder.glob("*.bpmn20.xml")))
    (folder / "summary.txt").write_text(report, encoding="utf-8")
