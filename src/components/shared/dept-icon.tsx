import {
  Shield, Flame, Truck, Users, Car, Stethoscope, Radio, Landmark, Hammer, Plane, Siren, Anchor, type LucideProps,
} from "lucide-react";

/** Icons a department can pick from. Keys are stored in departments.icon. */
export const DEPT_ICONS = {
  shield: Shield,
  flame: Flame,
  truck: Truck,
  users: Users,
  car: Car,
  stethoscope: Stethoscope,
  radio: Radio,
  landmark: Landmark,
  hammer: Hammer,
  plane: Plane,
  siren: Siren,
  anchor: Anchor,
} as const;

export type DeptIconName = keyof typeof DEPT_ICONS;

export function DeptIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = DEPT_ICONS[(name as DeptIconName) in DEPT_ICONS ? (name as DeptIconName) : "shield"];
  return <Icon {...props} />;
}
