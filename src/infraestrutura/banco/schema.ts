import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { EstadoCarreira } from "../../dominio/entidades/modelos";

// Declarativo: importado pelo Drizzle Kit sem criar conexão com o banco.
export const careerSaves = pgTable("career_saves", {
  id: uuid("id").defaultRandom().primaryKey(),
  saveVersion: integer("save_version").notNull(),
  name: text("name").notNull(),
  currentClubId: text("current_club_id"),
  currentLeagueId: text("current_league_id"),
  gameDate: date("game_date", { mode: "string" }).notNull(),
  state: jsonb("state").$type<EstadoCarreira>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Default vale no INSERT. Futuros UPDATEs devem definir updatedAt explicitamente.
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CareerSave = typeof careerSaves.$inferSelect;
export type NovoCareerSave = typeof careerSaves.$inferInsert;
