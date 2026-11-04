"""Convert Activiti 5 BPMN (iWorkflow) to Flowable BPMN without changing flow semantics.

- Keeps every element id, gateway condition, variable name, form key, due date and multi-instance setting.
- Switches the extension namespace activiti -> flowable.
- Maps legacy com.eform.* Java classes to the new backend delegates (same behaviour, new package).
Usage: python convert_bpmn_flowable.py <src_dir> <dst_dir>
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

CLASS_MAP = {
    "com.eform.activiti.listener.MailNotificationListener": "vn.btmv.iworkflow.workflow.delegate.TaskAssignedMailListener",
    "com.eform.activiti.listener.MailccDaiDienPhong": "vn.btmv.iworkflow.workflow.delegate.TaskAssignedMailCcSectionListener",
    "com.eform.servicetask.MultiInstanceProcessData": "vn.btmv.iworkflow.workflow.delegate.LoopItemVariablesDelegate",
    "com.eform.servicetask.CreateEmailPheDuyetTask": "vn.btmv.iworkflow.workflow.delegate.EmailApprovalTokenDelegate",
    "com.eform.servicetask.CreateEmailRejectTask": "vn.btmv.iworkflow.workflow.delegate.RejectNotificationDelegate",
    "com.eform.servicetask.ServicesSaveInfoTemplate": "vn.btmv.iworkflow.workflow.delegate.SaveKeyProcessDelegate",
    "com.eform.servicetask.SendMailConfigTemplateServices": "vn.btmv.iworkflow.workflow.delegate.ConfiguredMailDelegate",
}
ACT_NS = "http://activiti.org/bpmn"
FLW_NS = "http://flowable.org/bpmn"
BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"


def convert(src: Path, dst: Path) -> dict:
    text = src.read_text(encoding="utf-8")
    legacy = re.findall(r'\bclass="(com\.eform\.[^"]+)"', text)
    unmapped = sorted(set(legacy) - set(CLASS_MAP))
    if unmapped:
        raise SystemExit(f"{src.name}: no mapping for {unmapped}")
    used = sorted(set(legacy))
    for old, new in CLASS_MAP.items():
        text = re.sub(rf'\b((?:activiti:)?class=")({re.escape(old)})"', rf'\g<1>{new}"', text)
    text = text.replace(f'xmlns:activiti="{ACT_NS}"', f'xmlns:flowable="{FLW_NS}"')
    text = re.sub(r"(</?|\s)activiti:", r"\1flowable:", text)
    if "com.eform" in text:
        raise SystemExit(f"{src.name}: legacy class reference left after conversion")
    ET.fromstring(text.encode("utf-8"))  # well-formedness check
    dst.write_text(text, encoding="utf-8")
    return {"file": dst.name, "delegates": [CLASS_MAP[c] for c in used]}


def element_ids(path: Path) -> set:
    root = ET.parse(path).getroot()
    return {el.get("id") for el in root.iter() if el.get("id") and el.tag.startswith("{" + BPMN_NS)}


if __name__ == "__main__":
    src_dir, dst_dir = Path(sys.argv[1]), Path(sys.argv[2])
    dst_dir.mkdir(parents=True, exist_ok=True)
    for f in sorted(src_dir.glob("*.bpmn20.xml")):
        out = dst_dir / f.name
        info = convert(f, out)
        same = element_ids(f) == element_ids(out)
        print(f"{f.name}: ids_preserved={same} delegates={info['delegates']}")
