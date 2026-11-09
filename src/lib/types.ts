export type Entity =
  | "rooms"
  | "ideas"
  | "tasks"
  | "projects"
  | "expenses"
  | "wishlist_items"
  | "calendar_events"
  | "maintenance_items"
  | "documents"
  | "budgets"
  | "savings_goals"
  | "suppliers";
export type RecordData = {
  id: string;
  household_id: string;
  title: string;
  description?: string;
  status?: string;
  image_url?: string | null;
  room_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  version: number;
  due_date?: string | null;
  start_date?: string | null;
  starts_at?: string;
  ends_at?: string;
  priority?: string;
  assignee_id?: string | null;
  amount_cents?: number;
  budget_cents?: number;
  cost_cents?: number;
  price_cents?: number;
  saved_cents?: number;
  expense_date?: string;
  category?: string;
  quantity?: number;
  store?: string;
  phone?: string;
  email?: string;
  url?: string;
  favorite?: boolean;
  tags?: string[];
  frequency_months?: number;
  last_done?: string;
  paint?: string;
  materials?: string;
  color?: keyof typeof import("./domain/room-colors").roomColors | null;
  width_cm?: number;
  length_cm?: number;
  sort_order?: number;
  duration_minutes?: number;
  storage_path?: string;
  filename?: string;
  mime_type?: string;
  bytes?: number;
  expense_id?: string | null;
  refund_of?: string | null;
  reversed_at?: string | null;
};
export type Member = {
  user_id: string;
  profiles: { display_name: string };
  avatarUrl?: string;
};
export type Child = {
  id: string;
  household_id: string;
  title?: string;
  body?: string;
  caption?: string;
  done?: boolean;
  task_id?: string;
  idea_id?: string;
  room_id?: string;
  project_id?: string;
  maintenance_id?: string;
  performed_on?: string;
  cost_cents?: number;
  user_id?: string;
  storage_path?: string;
  created_at?: string;
};
export type Settlement = {
  id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  created_at: string;
  reversed_at: string | null;
};
export type ShoppingItem = {
  id: string;
  title: string;
  quantity: string;
  store: string;
  done: boolean;
  version: number;
};

export type ShoppingRecipe = {
  id: string;
  title: string;
  ingredients: string[];
  quantities: string[] | null;
  portions: number;
};

export type Snapshot = {
  shoppingRecipes: ShoppingRecipe[];
  notifications: {
    id: string;
    task_id: string | null;
    title: string;
    read_at: string | null;
    created_at: string;
  }[];
  orders?: import("./domain/order").RecordOrder[];
  shopping: ShoppingItem[];
  configured: boolean;
  user: { id: string; email?: string } | null;
  household: { id: string; name: string } | null;
  members: Member[];
  records: Record<Entity, RecordData[]>;
  payments: { expense_id: string; user_id: string; amount_cents: number }[];
  shares: { expense_id: string; user_id: string; amount_cents: number }[];
  settlements: Settlement[];
  activity: {
    id: string;
    title: string;
    action: string;
    entity: string;
    entity_id: string | null;
    created_at: string;
    user_id: string | null;
  }[];
  children: Record<string, Child[]>;
};
export const entities: Entity[] = [
  "rooms",
  "ideas",
  "tasks",
  "projects",
  "expenses",
  "wishlist_items",
  "calendar_events",
  "maintenance_items",
  "documents",
  "budgets",
  "savings_goals",
  "suppliers",
];
export const emptyRecords = () =>
  Object.fromEntries(entities.map((e) => [e, []])) as unknown as Record<
    Entity,
    RecordData[]
  >;
