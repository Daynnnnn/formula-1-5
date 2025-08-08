import {
  integer,
  sqliteTable,
  primaryKey,
  text,
  uniqueIndex,
  real,
} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  sessionKey: integer("session_key").primaryKey().notNull(),
  meetingKey: integer("meeting_key").notNull(),
  location: text("location").notNull(),
  dateStart: text("date_start").notNull(),
  dateEnd: text("date_end").notNull(),
  sessionType: text("session_type").notNull(),
  sessionName: text("session_name").notNull(),
  countryKey: integer("country_key").notNull(),
  countryCode: text("country_code").notNull(),
  countryName: text("country_name").notNull(),
  circuitKey: integer("circuit_key").notNull(),
  circuitShortName: text("circuit_short_name").notNull(),
  gmtOffset: text("gmt_offset").notNull(),
  year: integer("year").notNull(),
});

export const sessionResults = sqliteTable(
  "session_results",
  {
    sessionKey: integer("session_key")
      .notNull()
      .references(() => sessions.sessionKey, { onDelete: "cascade" }),
    driverNumber: integer("driver_number").notNull(),
    position: integer("position"),
    numberOfLaps: integer("number_of_laps"),
    dnf: integer("dnf", { mode: "boolean" }).notNull().default(false),
    dns: integer("dns", { mode: "boolean" }).notNull().default(false),
    dsq: integer("dsq", { mode: "boolean" }).notNull().default(false),
    duration: integer("duration"),
    gapToLeader: real("gap_to_leader"),
    meetingKey: integer("meeting_key").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sessionKey, table.driverNumber] }),
  }),
);

export const drivers = sqliteTable(
  "drivers",
  {
    sessionKey: integer("session_key")
      .notNull()
      .references(() => sessions.sessionKey, { onDelete: "cascade" }),
    meetingKey: integer("meeting_key").notNull(),
    driverNumber: integer("driver_number").notNull(),
    broadcastName: text("broadcast_name").notNull(),
    countryCode: text("country_code").notNull(),
    firstName: text("first_name").notNull(),
    fullName: text("full_name").notNull(),
    headshotUrl: text("headshot_url"),
    lastName: text("last_name").notNull(),
    nameAcronym: text("name_acronym").notNull(),
    teamColour: text("team_colour").notNull(),
    teamName: text("team_name").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sessionKey, table.driverNumber] }),
  }),
);


