// Fictional role holders for the 4M wireframe. Section codes are real (HT_DONVI); names are not.

export type Person = {
  id: string;
  name: string;
  email: string;
  section: string;
  title: string;
  groups?: string[];
};

export const people: Person[] = [
  { id: "bao", name: "Phạm Quốc Bảo", email: "bao.pq@btmv.vn", section: "8311", title: "Kỹ sư ENG" },
  { id: "linh", name: "Trần Thùy Linh", email: "linh.tt@btmv.vn", section: "8311", title: "Kỹ sư ENG" },
  { id: "son", name: "Nguyễn Hoàng Sơn", email: "son.nh@btmv.vn", section: "8311", title: "Trưởng phòng ENG (kiêm GM)" },
  { id: "hanh", name: "Lê Thị Hạnh", email: "hanh.lt@btmv.vn", section: "3221", title: "Trưởng phòng EHS", groups: ["322A"] },
  { id: "khoa", name: "Đặng Minh Khoa", email: "khoa.dm@btmv.vn", section: "3221", title: "Cán bộ EHS", groups: ["322A"] },
  { id: "tung", name: "Võ Thanh Tùng", email: "tung.vt@btmv.vn", section: "3211", title: "Trưởng phòng QA" },
  { id: "anh", name: "Bùi Ngọc Ánh", email: "anh.bn@btmv.vn", section: "3211", title: "Cán bộ QA" },
  { id: "long", name: "Hà Đức Long", email: "long.hd@btmv.vn", section: "3211", title: "GM QA" },
  { id: "luc", name: "Phan Văn Lực", email: "luc.pv@btmv.vn", section: "8411", title: "Trưởng phòng TS" },
  { id: "hai", name: "Lý Thanh Hải", email: "hai.lt@btmv.vn", section: "8411", title: "Cán bộ TS" },
  { id: "vinh", name: "Đỗ Quang Vinh", email: "vinh.dq@btmv.vn", section: "8411", title: "GM TS" },
  { id: "thang", name: "Nguyễn Văn Thắng", email: "thang.nv@btmv.vn", section: "8511", title: "Trưởng xưởng SX1" },
  { id: "quan", name: "Trịnh Minh Quân", email: "quan.tm@btmv.vn", section: "8511", title: "Cán bộ SX1" },
  { id: "tri", name: "Hồ Minh Trí", email: "tri.hm@btmv.vn", section: "8512", title: "Trưởng xưởng SX2" },
  { id: "sato", name: "Kenji Sato", email: "k.sato@btmv.vn", section: "8511", title: "Plant Manager" },
  { id: "thu", name: "Mai Thị Thu", email: "thu.mt@btmv.vn", section: "3212H", title: "Trưởng phòng FI" },
  { id: "phuc", name: "Châu Văn Phúc", email: "phuc.cv@btmv.vn", section: "8514", title: "Trưởng phòng VMEC" },
  { id: "nam", name: "Vũ Đình Nam", email: "nam.vd@btmv.vn", section: "1511", title: "Trưởng nhóm IT" },
  { id: "hoa", name: "Ngô Thị Hoa", email: "hoa.nt@btmv.vn", section: "1511", title: "Kỹ sư IT" },
  { id: "an", name: "Nguyễn An", email: "an.n@btmv.vn", section: "1213", title: "Trưởng phòng GA" },
  { id: "ngoc", name: "Trịnh Bảo Ngọc", email: "ngoc.tb@btmv.vn", section: "1213", title: "GM HR" },
  { id: "huy", name: "Lâm Gia Huy", email: "huy.lg@btmv.vn", section: "3311", title: "Trưởng phòng PUR" },
  { id: "gd", name: "Toshiaki Matsushima", email: "t.matsushima@btmv.vn", section: "800", title: "Tổng Giám đốc" },
];

// nguoi_dai_dien / lanh_dao_dai_dien per section (8311 and 3311: manager = GM, as on prod).
export const org: Record<string, { manager: string; gm: string; staff: string[] }> = {
  "8311": { manager: "son", gm: "son", staff: ["bao", "linh"] },
  "3221": { manager: "hanh", gm: "long", staff: ["khoa"] },
  "3211": { manager: "tung", gm: "long", staff: ["anh"] },
  "8411": { manager: "luc", gm: "vinh", staff: ["hai"] },
  "8511": { manager: "thang", gm: "sato", staff: ["quan"] },
  "8512": { manager: "tri", gm: "sato", staff: [] },
  "3212H": { manager: "thu", gm: "tung", staff: [] },
  "8514": { manager: "phuc", gm: "sato", staff: [] },
  "1213": { manager: "an", gm: "ngoc", staff: [] },
  "3311": { manager: "huy", gm: "huy", staff: [] },
  "1511": { manager: "nam", gm: "sato", staff: ["hoa"] },
};

export const GD_ID = "gd";
export const EHS_GROUP = "322A";

/** iw_prod read-only mode: swap the fictional directory for the real one in place (helpers read the live arrays). */
export function replaceDirectory(nextPeople: Person[], nextOrg: typeof org) {
  people.splice(0, people.length, ...nextPeople);
  for (const k of Object.keys(org)) delete org[k];
  Object.assign(org, nextOrg);
}

export const personById = (id: string) => people.find((p) => p.id === id);
export const personName = (id: string) => personById(id)?.name ?? id;
export const managerOf = (section: string) => org[section]?.manager ?? "";
export const gmOf = (section: string) => org[section]?.gm ?? "";
export const staffOf = (section: string) => org[section]?.staff ?? [];
export const isEhs = (id: string) => personById(id)?.groups?.includes(EHS_GROUP) ?? false;
/** Sections a person manages (as representative), used for "Đơn vị của tôi". */
export const managedSections = (id: string) => Object.entries(org).filter(([, o]) => o.manager === id || o.gm === id).map(([code]) => code);

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
