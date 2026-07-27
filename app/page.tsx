import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// The sales stat, per client:
// "Last 30 days: X missed calls. We texted back Y. Z turned into conversations."

interface ClientStats {
  name: string;
  missed: number;
  textedBack: number;
  recovered: number;
}

async function getStats(): Promise<ClientStats[]> {
  const supabase = db();
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const { data: clients } = await supabase.from("clients").select("id, name");
  if (!clients) return [];

  const stats: ClientStats[] = [];
  for (const client of clients) {
    const { data: events } = await supabase
      .from("call_events")
      .select("id, texted_back, contact_id")
      .eq("client_id", client.id)
      .in("call_status", ["no-answer", "busy", "failed"])
      .gte("occurred_at", since);

    const missed = events?.length ?? 0;
    const textedBack = events?.filter((e) => e.texted_back).length ?? 0;

    const { count: recovered } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .in("status", ["replied", "booked"])
      .gte("created_at", since);

    stats.push({ name: client.name, missed, textedBack, recovered: recovered ?? 0 });
  }
  return stats;
}

const card: React.CSSProperties = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 12,
  padding: "20px 24px",
  marginBottom: 16,
};

export default async function Dashboard() {
  let stats: ClientStats[] = [];
  let error: string | null = null;
  try {
    stats = await getStats();
  } catch {
    error = "Couldn't reach Supabase — check env vars.";
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Solvic — Missed-Call Recovery</h1>
      <p style={{ color: "#8b949e", marginTop: 0, marginBottom: 32 }}>
        Last 30 days
      </p>

      {error && <div style={card}>{error}</div>}
      {!error && stats.length === 0 && (
        <div style={card}>No clients yet. Run <code>npm run seed</code>.</div>
      )}

      {stats.map((s) => (
        <div key={s.name} style={card}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            {s.name}
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <Stat label="Missed calls" value={s.missed} />
            <Stat label="Texted back" value={s.textedBack} color="#58a6ff" />
            <Stat label="Recovered" value={s.recovered} color="#3fb950" />
          </div>
        </div>
      ))}
    </main>
  );
}

function Stat({
  label,
  value,
  color = "#e6edf3",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8b949e" }}>{label}</div>
    </div>
  );
}
