import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Film, Star, CalendarDays, Plus, X, Trash2, Link2, Loader2, Search, ExternalLink,
  ThumbsUp, Trophy, ChevronLeft, ChevronRight, Sparkles, Users, Clock, Sun
} from "lucide-react";

// ---------- storage helpers ----------
async function loadKey(key, shared, fallback) {
  try {
    const res = await window.storage.get(key, shared);
    if (res && res.value !== undefined) return JSON.parse(res.value);
    return fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, shared, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
  } catch (e) {
    console.error("storage save failed:", key, e);
  }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function extractField(text, name) {
  const m = text.match(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() : "";
}

function parseMovieResponse(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (e) {
      // fall through to a more forgiving field-by-field extraction below
    }
  }
  return {
    title: extractField(clean, "title"), year: extractField(clean, "year"),
    poster: extractField(clean, "poster"), rating: extractField(clean, "rating"),
    synopsis: extractField(clean, "synopsis"), genre: extractField(clean, "genre"),
    imdbUrl: extractField(clean, "imdbUrl"),
  };
}

function googleImagesSearchUrl(title, year) {
  const q = `${title || ""} ${year || ""} movie poster`.trim();
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
}

async function fetchMovieDetails(query) {
  const prompt = `Search the web to find this movie on IMDb: "${query}"
This input may be an IMDb URL, or it may just be a movie title (possibly with a year) — figure out which and search accordingly.
Also specifically search for "<title> movie poster" to find a poster image.
Once you've found it, respond with ONLY a single raw JSON object — no markdown, no code fences, no text before or after it — in exactly this shape:
{"title":"","year":"","poster":"","rating":"","synopsis":"","genre":"","imdbUrl":""}
Rules:
- "synopsis" must be 1-2 short sentences in your own words, under 200 characters, with no double-quote characters inside it.
- "poster" must be a direct https URL ending in .jpg, .jpeg, .png, or .webp that points straight at a movie poster image. Strongly prefer images hosted on upload.wikimedia.org, image.tmdb.org, or m.media-amazon.com, since those load reliably when embedded elsewhere. If you can't find a URL matching that pattern, leave it as an empty string rather than guessing or linking to a webpage instead of an image.
- "rating" is the IMDb score out of 10 as a plain string, e.g. "7.8".
- "genre" is a short comma separated list, e.g. "Comedy, Drama".
- "imdbUrl" is the canonical https://www.imdb.com/title/... URL for the film if you can find it, otherwise an empty string.
- If several films share a similar title, pick the best-known one.
- The JSON must be valid: no trailing commas, no unescaped quotes.
- If you truly cannot identify the film, return the JSON with every field as an empty string.
- Output the JSON object and nothing else.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text.trim()) throw new Error("Empty response");
  return parseMovieResponse(text);
}

// ---------- generated poster art (no network required) ----------
const POSTER_THEMES = [
  ["#FF6B4A", "#8C3B4A"], ["#2B2255", "#5A2A52"], ["#FFC857", "#FF6B4A"],
  ["#5A2A52", "#1B1F3B"], ["#8C3B4A", "#2B2255"], ["#3B2E7A", "#FF6B4A"],
];
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function wrapTitle(title, maxChars = 13) {
  const words = String(title || "Untitled").split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines.slice(0, 4);
}
function generatePoster(movie) {
  const [c1, c2] = POSTER_THEMES[hashStr(movie.title || "x") % POSTER_THEMES.length];
  const lines = wrapTitle(movie.title, 13);
  const startY = 150 - (lines.length - 1) * 15;
  const textLines = lines.map((l, i) =>
    `<text x="100" y="${startY + i * 30}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="22" fill="#F5EDE0">${escapeXml(l)}</text>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="200" height="300" fill="url(#g)"/>
    <circle cx="100" cy="58" r="24" fill="none" stroke="#F5EDE0" stroke-opacity="0.55" stroke-width="2"/>
    <circle cx="100" cy="58" r="7" fill="#F5EDE0" fill-opacity="0.55"/>
    <line x1="100" y1="34" x2="100" y2="20" stroke="#F5EDE0" stroke-opacity="0.55" stroke-width="2"/>
    <line x1="122" y1="58" x2="136" y2="58" stroke="#F5EDE0" stroke-opacity="0.55" stroke-width="2"/>
    <line x1="100" y1="82" x2="100" y2="96" stroke="#F5EDE0" stroke-opacity="0.55" stroke-width="2"/>
    <line x1="78" y1="58" x2="64" y2="58" stroke="#F5EDE0" stroke-opacity="0.55" stroke-width="2"/>
    ${textLines}
    <text x="100" y="272" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#F5EDE0" fill-opacity="0.65">${escapeXml(movie.year || "")}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ---------- date helpers ----------
const toKey = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayKey = toKey(new Date());
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState([]);
  const [poll, setPoll] = useState({ id: uid(), nominees: [], votes: {} });
  const [calendarEvents, setCalendarEvents] = useState({});
  const [nextMovie, setNextMovie] = useState(null);
  const [myName, setMyName] = useState("");
  const [nameDraft, setNameDraft] = useState("");

  const [tab, setTab] = useState("library");
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [fetchState, setFetchState] = useState("idle"); // idle | loading | done | error
  const [draft, setDraft] = useState(null);
  const [addError, setAddError] = useState("");

  const [selectedMovie, setSelectedMovie] = useState(null);

  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventMovieId, setEventMovieId] = useState("");
  const [eventNote, setEventNote] = useState("");

  useEffect(() => {
    (async () => {
      const [m, p, c, nm, name] = await Promise.all([
        loadKey("movies", true, []),
        loadKey("poll", true, { id: uid(), nominees: [], votes: {} }),
        loadKey("calendar-events", true, {}),
        loadKey("next-movie", true, null),
        loadKey("my-name", false, ""),
      ]);
      setMovies(m); setPoll(p); setCalendarEvents(c); setNextMovie(nm); setMyName(name);
      setLoading(false);
    })();
  }, []);

  const updateMovies = useCallback(async (next) => { setMovies(next); await saveKey("movies", true, next); }, []);
  const updatePoll = useCallback(async (next) => { setPoll(next); await saveKey("poll", true, next); }, []);
  const updateCalendar = useCallback(async (next) => { setCalendarEvents(next); await saveKey("calendar-events", true, next); }, []);
  const updateNextMovie = useCallback(async (next) => { setNextMovie(next); await saveKey("next-movie", true, next); }, []);
  const updateMyName = useCallback(async (name) => { setMyName(name); await saveKey("my-name", false, name); }, []);

  const crowned = useMemo(() => movies.find((m) => m.id === nextMovie?.movieId) || null, [movies, nextMovie]);

  // ---------- add movie ----------
  const resetAddForm = () => { setShowAdd(false); setQuery(""); setFetchState("idle"); setDraft(null); setAddError(""); };

  const doFetch = async () => {
    if (!query.trim()) { setAddError("Enter an IMDb link or a movie title first."); return; }
    setAddError(""); setFetchState("loading");
    const typedUrl = query.trim().startsWith("http") ? query.trim() : "";
    try {
      const info = await fetchMovieDetails(query.trim());
      if (!info.title) throw new Error("Couldn't identify that title");
      setDraft({
        title: info.title || "", year: info.year || "", poster: info.poster || "",
        rating: info.rating || "", synopsis: info.synopsis || "", genre: info.genre || "",
        imdbUrl: info.imdbUrl || typedUrl,
      });
      setFetchState("done");
    } catch (e) {
      setFetchState("error");
      setAddError("Couldn't find a confident match — try adding the release year, or fill the details in manually below.");
      setDraft({ title: typedUrl ? "" : query.trim(), year: "", poster: "", rating: "", synopsis: "", genre: "", imdbUrl: typedUrl });
    }
  };

  const confirmAdd = async () => {
    if (!draft?.title?.trim()) { setAddError("Give it a title before adding."); return; }
    const movie = { id: uid(), ...draft, addedAt: Date.now() };
    await updateMovies([movie, ...movies]);
    resetAddForm();
  };

  const removeMovie = async (id) => {
    await updateMovies(movies.filter((m) => m.id !== id));
    if (poll.nominees.includes(id)) {
      const nominees = poll.nominees.filter((n) => n !== id);
      const votes = { ...poll.votes }; delete votes[id];
      await updatePoll({ ...poll, nominees, votes });
    }
    if (nextMovie?.movieId === id) await updateNextMovie(null);
    setSelectedMovie((cur) => (cur && cur.id === id ? null : cur));
  };

  const openMovie = (m) => setSelectedMovie(m);
  const closeMovie = () => setSelectedMovie(null);
  const updateMovieField = async (id, patch) => {
    const next = movies.map((m) => (m.id === id ? { ...m, ...patch } : m));
    await updateMovies(next);
    setSelectedMovie((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));
  };

  // ---------- nominations ----------
  const nominate = async (id) => {
    if (poll.nominees.includes(id) || poll.nominees.length >= 3) return;
    await updatePoll({ ...poll, nominees: [...poll.nominees, id] });
  };
  const unnominate = async (id) => {
    const votes = { ...poll.votes }; delete votes[id];
    await updatePoll({ ...poll, nominees: poll.nominees.filter((n) => n !== id), votes });
  };

  // ---------- voting ----------
  const myVote = useMemo(() => {
    for (const [mid, names] of Object.entries(poll.votes || {})) if (names.includes(myName)) return mid;
    return null;
  }, [poll, myName]);

  const castVote = async (movieId) => {
    if (!myName) return;
    const votes = {};
    for (const [mid, names] of Object.entries(poll.votes || {})) votes[mid] = names.filter((n) => n !== myName);
    votes[movieId] = [...(votes[movieId] || []), myName];
    await updatePoll({ ...poll, votes });
  };

  const totalVotes = useMemo(() => Object.values(poll.votes || {}).reduce((s, arr) => s + arr.length, 0), [poll]);

  const crownWinner = async () => {
    let winnerId = null, max = -1;
    for (const mid of poll.nominees) {
      const n = (poll.votes[mid] || []).length;
      if (n > max) { max = n; winnerId = mid; }
    }
    if (!winnerId) return;
    await updateNextMovie({ movieId: winnerId, crownedAt: Date.now() });
    await updatePoll({ id: uid(), nominees: [], votes: {} });
    setTab("library");
  };

  const resetNominees = async () => { await updatePoll({ id: uid(), nominees: [], votes: {} }); };

  // ---------- calendar ----------
  const daysInGrid = useMemo(() => {
    const first = new Date(viewMonth); first.setDate(1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d));
    return cells;
  }, [viewMonth]);

  const addEvent = async () => {
    if (!selectedDate || !eventMovieId) return;
    const key = toKey(selectedDate);
    const existing = calendarEvents[key] || [];
    const next = { ...calendarEvents, [key]: [...existing, { id: uid(), movieId: eventMovieId, note: eventNote.trim() }] };
    await updateCalendar(next);
    setEventMovieId(""); setEventNote("");
  };
  const removeEvent = async (dateKey, eventId) => {
    const remaining = (calendarEvents[dateKey] || []).filter((e) => e.id !== eventId);
    const next = { ...calendarEvents };
    if (remaining.length) next[dateKey] = remaining; else delete next[dateKey];
    await updateCalendar(next);
  };

  const upcoming = useMemo(() => {
    const out = [];
    for (const [dateKey, events] of Object.entries(calendarEvents)) {
      if (dateKey < todayKey) continue;
      for (const ev of events) out.push({ dateKey, ...ev });
    }
    return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [calendarEvents]);

  if (loading) {
    return (
      <div style={{ background: PALETTE.dusk }} className="min-h-screen flex items-center justify-center text-amber-100">
        <Loader2 className="animate-spin mr-3" /> <span className="font-mono text-sm tracking-widest">LOADING THE PROJECTOR…</span>
      </div>
    );
  }

  return (
    <div style={{ background: PALETTE.dusk, fontFamily: "'Space Grotesk', sans-serif" }} className="min-h-screen text-amber-50">
      <FontImports />
      <SprocketBar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <Header />
        <Hero crowned={crowned} onPlan={() => { setTab("calendar"); if (crowned) setEventMovieId(crowned.id); }} onOpen={openMovie} />

        <Tabs tab={tab} setTab={setTab} nomineeCount={poll.nominees.length} upcomingCount={upcoming.length} />

        {tab === "library" && (
          <Library
            movies={movies}
            poll={poll}
            showAdd={showAdd} setShowAdd={setShowAdd}
            query={query} setQuery={setQuery}
            fetchState={fetchState} doFetch={doFetch}
            draft={draft} setDraft={setDraft}
            addError={addError} confirmAdd={confirmAdd} resetAddForm={resetAddForm}
            nominate={nominate} removeMovie={removeMovie} onOpen={openMovie}
          />
        )}

        {tab === "vote" && (
          <VoteTab
            movies={movies} poll={poll} myName={myName} nameDraft={nameDraft} setNameDraft={setNameDraft}
            updateMyName={updateMyName} myVote={myVote} castVote={castVote} totalVotes={totalVotes}
            unnominate={unnominate} resetNominees={resetNominees} crownWinner={crownWinner} onOpen={openMovie}
          />
        )}

        {tab === "calendar" && (
          <CalendarTab
            viewMonth={viewMonth} setViewMonth={setViewMonth} daysInGrid={daysInGrid}
            calendarEvents={calendarEvents} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            movies={movies} eventMovieId={eventMovieId} setEventMovieId={setEventMovieId}
            eventNote={eventNote} setEventNote={setEventNote} addEvent={addEvent} removeEvent={removeEvent}
            upcoming={upcoming} crowned={crowned} onOpen={openMovie}
          />
        )}

        <p className="text-center text-xs text-amber-200/40 font-mono mt-12">
          🌇 shared clubhouse — movies, votes &amp; the calendar are visible to everyone who opens this page
        </p>
      </div>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={closeMovie}
          nominated={poll.nominees.includes(selectedMovie.id)}
          nominateFull={poll.nominees.length >= 3}
          onNominate={() => nominate(selectedMovie.id)}
          onRemove={() => removeMovie(selectedMovie.id)}
          onUpdatePoster={(url) => updateMovieField(selectedMovie.id, { poster: url })}
        />
      )}
    </div>
  );
}

// ---------- palette / fonts / decor ----------
const PALETTE = {
  dusk: "linear-gradient(180deg,#1B1F3B 0%,#2B2255 45%,#5A2A52 75%,#8C3B4A 100%)",
  coral: "#FF6B4A",
  gold: "#FFC857",
  paper: "#F5EDE0",
  ink: "#141420",
};

function FontImports() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
      .marquee-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.04em; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      @keyframes blink { 0%,49%{opacity:1;} 50%,100%{opacity:0.15;} }
      .bulb { animation: blink 1.6s infinite; }
      @media (prefers-reduced-motion: reduce) { .bulb { animation: none; } }
    `}</style>
  );
}

function SprocketBar() {
  const holes = Array.from({ length: 40 });
  return (
    <div className="h-3 w-full flex items-center justify-around" style={{ background: PALETTE.ink }}>
      {holes.map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#1B1F3B" }} />)}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-center gap-3 pt-8 pb-2">
      <Sun size={22} style={{ color: PALETTE.gold }} />
      <h1 className="marquee-font text-4xl sm:text-5xl tracking-wide text-center" style={{ color: PALETTE.gold, textShadow: "0 0 18px rgba(255,200,87,0.35)" }}>
        Summer Cinema Club
      </h1>
      <Sun size={22} style={{ color: PALETTE.gold }} />
    </div>
  );
}

function Hero({ crowned, onPlan, onOpen }) {
  const bulbs = Array.from({ length: 24 });
  return (
    <div className="relative mt-4 rounded-2xl overflow-hidden" style={{ background: PALETTE.ink, border: `3px solid ${PALETTE.gold}` }}>
      <div className="flex justify-around px-2 pt-2">
        {bulbs.map((_, i) => (
          <span key={i} className="bulb w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.gold, animationDelay: `${(i % 6) * 0.15}s` }} />
        ))}
      </div>
      <div className="p-5 sm:p-7">
        {crowned ? (
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <button onClick={() => onOpen(crowned)} className="shrink-0">
              <PosterImg movie={crowned} className="w-32 h-48 rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition" />
            </button>
            <div className="flex-1 text-center sm:text-left">
              <div className="mono text-xs tracking-[0.3em]" style={{ color: PALETTE.coral }}>NOW CROWNED · NEXT SHOWING</div>
              <button onClick={() => onOpen(crowned)} className="marquee-font text-3xl sm:text-4xl mt-1 hover:opacity-80 transition text-left" style={{ color: PALETTE.gold }}>{crowned.title}</button>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-1 text-amber-100/80 text-sm">
                {crowned.year && <span>{crowned.year}</span>}
                {crowned.rating && <span className="flex items-center gap-1"><Star size={14} className="fill-current" style={{ color: PALETTE.gold }} /> {crowned.rating}</span>}
              </div>
              {crowned.synopsis && <p className="text-sm text-amber-100/70 mt-2 max-w-xl">{crowned.synopsis}</p>}
              <button onClick={onPlan} className="mono mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: PALETTE.coral, color: PALETTE.ink }}>
                <CalendarDays size={15} /> Plan the screening
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Trophy className="mx-auto mb-2" style={{ color: PALETTE.gold }} />
            <div className="marquee-font text-2xl" style={{ color: PALETTE.gold }}>No movie crowned yet</div>
            <p className="text-sm text-amber-100/60 mt-1">Nominate up to 3 films in the Library, then vote for opening night.</p>
          </div>
        )}
      </div>
      <div className="flex justify-around px-2 pb-2">
        {bulbs.map((_, i) => (
          <span key={i} className="bulb w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.gold, animationDelay: `${(i % 6) * 0.15 + 0.3}s` }} />
        ))}
      </div>
    </div>
  );
}

function PosterImg({ movie, className }) {
  const [broken, setBroken] = useState(false);
  const src = (!movie.poster || broken) ? generatePoster(movie) : movie.poster;
  return <img src={src} alt={movie.title || "poster"} onError={() => setBroken(true)} className={`${className} object-cover`} />;
}

function Tabs({ tab, setTab, nomineeCount, upcomingCount }) {
  const items = [
    { key: "library", label: "Library", icon: Film },
    { key: "vote", label: "Vote", icon: ThumbsUp, badge: nomineeCount || null },
    { key: "calendar", label: "Calendar", icon: CalendarDays, badge: upcomingCount || null },
  ];
  return (
    <div className="flex gap-2 justify-center mt-6 mb-6 flex-wrap">
      {items.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key} onClick={() => setTab(key)}
          className="mono flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition"
          style={tab === key
            ? { background: PALETTE.gold, color: PALETTE.ink, borderColor: PALETTE.gold }
            : { background: "transparent", color: PALETTE.paper, borderColor: "rgba(245,237,224,0.25)" }}
        >
          <Icon size={15} /> {label}
          {badge ? <span className="ml-1 text-xs px-1.5 rounded-full" style={{ background: PALETTE.coral, color: PALETTE.ink }}>{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---------- Library ----------
function Library({ movies, poll, showAdd, setShowAdd, query, setQuery, fetchState, doFetch, draft, setDraft, addError, confirmAdd, resetAddForm, nominate, removeMovie, onOpen }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="marquee-font text-2xl" style={{ color: PALETTE.paper }}>The Library</h2>
        <button onClick={() => setShowAdd(true)} className="mono flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold" style={{ background: PALETTE.coral, color: PALETTE.ink }}>
          <Plus size={15} /> Add movie
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 rounded-xl p-4" style={{ background: "rgba(20,20,32,0.55)", border: "1px solid rgba(255,200,87,0.3)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono text-xs tracking-widest" style={{ color: PALETTE.gold }}>ADD A MOVIE</span>
            <button onClick={resetAddForm}><X size={16} className="text-amber-100/60" /></button>
          </div>

          {!draft && (
            <div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(245,237,224,0.08)" }}>
                  {query.trim().startsWith("http") ? <Link2 size={15} className="text-amber-100/50 shrink-0" /> : <Search size={15} className="text-amber-100/50 shrink-0" />}
                  <input
                    value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Paste an IMDb link, or just type a movie title…"
                    className="bg-transparent outline-none text-sm flex-1 text-amber-50 placeholder:text-amber-100/30"
                    onKeyDown={(e) => e.key === "Enter" && doFetch()}
                  />
                </div>
                <button onClick={doFetch} disabled={fetchState === "loading"} className="mono px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: PALETTE.gold, color: PALETTE.ink }}>
                  {fetchState === "loading" ? <Loader2 size={15} className="animate-spin" /> : null}
                  {fetchState === "loading" ? "Searching…" : "Find it"}
                </button>
              </div>
              <p className="text-[11px] text-amber-100/35 mt-1.5">We'll search IMDb either way — a link is more precise, a title is faster.</p>
            </div>
          )}

          {addError && <p className="text-xs mt-2" style={{ color: PALETTE.coral }}>{addError}</p>}

          {draft && (
            <div className="mt-3 flex flex-col sm:flex-row gap-4">
              <PosterImg movie={draft} className="w-24 h-36 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className="w-full px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30" />
                <div className="flex gap-2">
                  <input value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} placeholder="Year" className="w-24 px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30" />
                  <input value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: e.target.value })} placeholder="IMDb rating" className="w-28 px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30" />
                  <input value={draft.genre} onChange={(e) => setDraft({ ...draft, genre: e.target.value })} placeholder="Genre" className="flex-1 px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30" />
                </div>
                <div className="flex items-center gap-2">
                  <input value={draft.poster} onChange={(e) => setDraft({ ...draft, poster: e.target.value })} placeholder="Poster image URL" className="flex-1 px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30" />
                  <a href={googleImagesSearchUrl(draft.title, draft.year)} target="_blank" rel="noopener noreferrer" className="mono text-[11px] shrink-0 px-2 py-1.5 rounded-md whitespace-nowrap" style={{ background: "rgba(255,200,87,0.12)", color: PALETTE.gold }}>
                    🔍 Google Images
                  </a>
                </div>
                <textarea value={draft.synopsis} onChange={(e) => setDraft({ ...draft, synopsis: e.target.value })} placeholder="Synopsis" rows={2} className="w-full px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30" />
                <div className="flex gap-2 pt-1">
                  <button onClick={confirmAdd} className="mono px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: PALETTE.gold, color: PALETTE.ink }}>Add to library</button>
                  <button onClick={resetAddForm} className="mono px-4 py-1.5 rounded-full text-sm text-amber-100/60 border border-amber-100/20">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {movies.length === 0 ? (
        <EmptyState icon={Film} text="No movies yet. Add one above — paste an IMDb link or just type a title." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {movies.map((m) => {
            const nominated = poll.nominees.includes(m.id);
            const full = poll.nominees.length >= 3;
            return (
              <div key={m.id} onClick={() => onOpen(m)} className="rounded-xl overflow-hidden flex flex-col cursor-pointer hover:-translate-y-0.5 transition" style={{ background: "rgba(20,20,32,0.5)", border: "1px solid rgba(245,237,224,0.12)" }}>
                <PosterImg movie={m} className="w-full h-56" />
                <div className="p-3 flex-1 flex flex-col">
                  <div className="font-semibold text-sm leading-snug" style={{ color: PALETTE.paper }}>{m.title} {m.year && <span className="text-amber-100/40 font-normal">({m.year})</span>}</div>
                  {m.rating && <div className="flex items-center gap-1 text-xs mt-1" style={{ color: PALETTE.gold }}><Star size={12} className="fill-current" /> {m.rating}</div>}
                  {m.synopsis && <p className="text-xs text-amber-100/60 mt-2 line-clamp-3">{m.synopsis}</p>}
                  <div className="mt-auto pt-3 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); nominate(m.id); }} disabled={nominated || full}
                      className="mono flex-1 text-xs px-2 py-1.5 rounded-full font-semibold disabled:opacity-40"
                      style={nominated ? { background: "rgba(255,200,87,0.15)", color: PALETTE.gold, border: `1px solid ${PALETTE.gold}` } : { background: PALETTE.coral, color: PALETTE.ink }}
                    >
                      {nominated ? "Nominated ✓" : full ? "Vote is full" : "Nominate"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeMovie(m.id); }} title="Remove"><Trash2 size={14} className="text-amber-100/40 hover:text-amber-100/80" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Vote ----------
function VoteTab({ movies, poll, myName, nameDraft, setNameDraft, updateMyName, myVote, castVote, totalVotes, unnominate, resetNominees, crownWinner, onOpen }) {
  const nominees = poll.nominees.map((id) => movies.find((m) => m.id === id)).filter(Boolean);

  if (!myName) {
    return (
      <div className="text-center py-10">
        <Users className="mx-auto mb-2" style={{ color: PALETTE.gold }} />
        <p className="text-amber-100/70 text-sm mb-3">Tell us who's voting — just once per person.</p>
        <div className="flex justify-center gap-2">
          <input
            value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your first name" onKeyDown={(e) => e.key === "Enter" && nameDraft.trim() && updateMyName(nameDraft.trim())}
            className="px-3 py-2 rounded-lg text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30"
          />
          <button onClick={() => nameDraft.trim() && updateMyName(nameDraft.trim())} className="mono px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: PALETTE.gold, color: PALETTE.ink }}>That's me</button>
        </div>
      </div>
    );
  }

  if (nominees.length === 0) {
    return <EmptyState icon={ThumbsUp} text="No nominees yet. Head to the Library and nominate up to 3 films for the next vote." />;
  }

  const maxVotes = Math.max(0, ...nominees.map((m) => (poll.votes[m.id] || []).length));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="marquee-font text-2xl" style={{ color: PALETTE.paper }}>Vote for Opening Night</h2>
        <span className="mono text-xs text-amber-100/50">Voting as <b style={{ color: PALETTE.gold }}>{myName}</b> · {totalVotes} vote{totalVotes === 1 ? "" : "s"} cast</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {nominees.map((m) => {
          const count = (poll.votes[m.id] || []).length;
          const mine = myVote === m.id;
          const leading = count > 0 && count === maxVotes;
          return (
            <div key={m.id} onClick={() => onOpen(m)} className="rounded-xl overflow-hidden relative cursor-pointer hover:-translate-y-0.5 transition" style={{ background: "rgba(20,20,32,0.5)", border: mine ? `2px solid ${PALETTE.gold}` : "1px solid rgba(245,237,224,0.12)" }}>
              {leading && <div className="absolute top-2 right-2 mono text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: PALETTE.gold, color: PALETTE.ink }}><Sparkles size={10} /> LEADING</div>}
              <PosterImg movie={m} className="w-full h-48" />
              <div className="p-3">
                <div className="font-semibold text-sm" style={{ color: PALETTE.paper }}>{m.title}</div>
                <div className="mono text-xs text-amber-100/50 mt-1">{count} vote{count === 1 ? "" : "s"}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); castVote(m.id); }}
                  className="mono w-full mt-2 text-xs px-2 py-1.5 rounded-full font-semibold flex items-center justify-center gap-1"
                  style={mine ? { background: "rgba(255,200,87,0.15)", color: PALETTE.gold, border: `1px solid ${PALETTE.gold}` } : { background: PALETTE.coral, color: PALETTE.ink }}
                >
                  <ThumbsUp size={13} /> {mine ? "Your pick" : "Vote"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); unnominate(m.id); }} className="mono w-full mt-1 text-[11px] text-amber-100/40 hover:text-amber-100/70">Remove nomination</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-3 mt-6">
        <button onClick={resetNominees} className="mono px-4 py-2 rounded-full text-xs text-amber-100/60 border border-amber-100/20">Clear nominees</button>
        <button onClick={crownWinner} disabled={totalVotes === 0} className="mono flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-40" style={{ background: PALETTE.gold, color: PALETTE.ink }}>
          <Trophy size={15} /> Crown winner &amp; start new round
        </button>
      </div>
    </div>
  );
}

// ---------- Calendar ----------
function CalendarTab({ viewMonth, setViewMonth, daysInGrid, calendarEvents, selectedDate, setSelectedDate, movies, eventMovieId, setEventMovieId, eventNote, setEventNote, addEvent, removeEvent, upcoming, crowned, onOpen }) {
  const changeMonth = (delta) => { const d = new Date(viewMonth); d.setMonth(d.getMonth() + delta); setViewMonth(d); };
  const selKey = selectedDate ? toKey(selectedDate) : null;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 rounded-xl p-4" style={{ background: "rgba(20,20,32,0.5)", border: "1px solid rgba(245,237,224,0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => changeMonth(-1)}><ChevronLeft className="text-amber-100/60" /></button>
          <span className="marquee-font text-xl" style={{ color: PALETTE.gold }}>{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
          <button onClick={() => changeMonth(1)}><ChevronRight className="text-amber-100/60" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mono text-[10px] text-amber-100/40 text-center mb-1">
          {DAY_NAMES.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {daysInGrid.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = toKey(d);
            const events = calendarEvents[key] || [];
            const isToday = key === todayKey;
            const isSel = key === selKey;
            return (
              <button
                key={i} onClick={() => setSelectedDate(d)}
                className="aspect-square rounded-lg text-xs flex flex-col items-center justify-center relative"
                style={{
                  background: isSel ? "rgba(255,200,87,0.2)" : "rgba(245,237,224,0.04)",
                  border: isToday ? `1px solid ${PALETTE.coral}` : "1px solid transparent",
                  color: PALETTE.paper,
                }}
              >
                {d.getDate()}
                {events.length > 0 && <span className="w-1.5 h-1.5 rounded-full absolute bottom-1.5" style={{ background: PALETTE.gold }} />}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(245,237,224,0.12)" }}>
            <div className="mono text-xs tracking-widest mb-2" style={{ color: PALETTE.gold }}>
              {selectedDate.toDateString().toUpperCase()}
            </div>
            {(calendarEvents[selKey] || []).map((ev) => {
              const mv = movies.find((m) => m.id === ev.movieId);
              return (
                <div key={ev.id} className="flex items-center justify-between text-sm py-1">
                  <span className="text-amber-100/80">🎬 {mv ? mv.title : "Unknown movie"} {ev.note && <span className="text-amber-100/40">— {ev.note}</span>}</span>
                  <button onClick={() => removeEvent(selKey, ev.id)}><X size={13} className="text-amber-100/40" /></button>
                </div>
              );
            })}
            {movies.length === 0 ? (
              <p className="text-xs text-amber-100/40 mt-2">Add a movie to the library first.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <select value={eventMovieId} onChange={(e) => setEventMovieId(e.target.value)} className="px-2 py-1.5 rounded-md text-xs bg-black/30 text-amber-50 outline-none flex-1">
                  <option value="">Choose a movie…</option>
                  {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <input value={eventNote} onChange={(e) => setEventNote(e.target.value)} placeholder="Note (optional)" className="px-2 py-1.5 rounded-md text-xs bg-black/30 text-amber-50 outline-none flex-1 placeholder:text-amber-100/30" />
                <button onClick={addEvent} disabled={!eventMovieId} className="mono px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40" style={{ background: PALETTE.coral, color: PALETTE.ink }}>Schedule</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="mono text-xs tracking-widest mb-3 flex items-center gap-2" style={{ color: PALETTE.gold }}><Clock size={13} /> UPCOMING SCREENINGS</h3>
        {upcoming.length === 0 ? (
          <p className="text-xs text-amber-100/40">Nothing on the calendar yet.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((ev) => {
              const mv = movies.find((m) => m.id === ev.movieId);
              const d = new Date(ev.dateKey + "T00:00:00");
              return (
                <div key={ev.id} onClick={() => mv && onOpen(mv)} className={`flex items-center gap-3 rounded-lg p-2 ${mv ? "cursor-pointer hover:bg-white/5" : ""}`} style={{ background: "rgba(20,20,32,0.5)" }}>
                  <PosterImg movie={mv || {}} className="w-10 h-14 rounded shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: PALETTE.paper }}>{mv ? mv.title : "Unknown"}</div>
                    <div className="mono text-[10px] text-amber-100/40">{d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MovieModal({ movie, onClose, nominated, nominateFull, onNominate, onRemove, onUpdatePoster }) {
  const [posterDraft, setPosterDraft] = useState(movie.poster || "");
  useEffect(() => { setPosterDraft(movie.poster || ""); }, [movie.id, movie.poster]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,10,16,0.75)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: PALETTE.ink, border: `2px solid ${PALETTE.gold}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full z-10" style={{ background: "rgba(0,0,0,0.5)" }}>
          <X size={18} className="text-amber-100" />
        </button>

        <div className="flex flex-col sm:flex-row gap-5 p-5 sm:p-6">
          <PosterImg movie={movie} className="w-full sm:w-48 h-64 sm:h-72 rounded-xl shrink-0 shadow-lg" />
          <div className="flex-1 min-w-0">
            <div className="marquee-font text-3xl leading-none" style={{ color: PALETTE.gold }}>{movie.title}</div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-amber-100/80">
              {movie.year && <span className="mono">{movie.year}</span>}
              {movie.rating && <span className="flex items-center gap-1"><Star size={14} className="fill-current" style={{ color: PALETTE.gold }} /> {movie.rating}/10</span>}
              {movie.genre && <span className="mono text-amber-100/50">{movie.genre}</span>}
            </div>
            {movie.synopsis && <p className="text-sm text-amber-100/75 mt-3 leading-relaxed">{movie.synopsis}</p>}

            {movie.imdbUrl && (
              <a href={movie.imdbUrl} target="_blank" rel="noopener noreferrer" className="mono inline-flex items-center gap-1.5 mt-3 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(255,200,87,0.12)", color: PALETTE.gold }}>
                <ExternalLink size={12} /> View on IMDb
              </a>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={onNominate} disabled={nominated || nominateFull}
                className="mono flex-1 text-xs px-3 py-2 rounded-full font-semibold disabled:opacity-40"
                style={nominated ? { background: "rgba(255,200,87,0.15)", color: PALETTE.gold, border: `1px solid ${PALETTE.gold}` } : { background: PALETTE.coral, color: PALETTE.ink }}
              >
                {nominated ? "Nominated ✓" : nominateFull ? "Vote is full" : "Nominate for next vote"}
              </button>
              <button onClick={onRemove} title="Remove from library" className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <Trash2 size={15} className="text-amber-100/60" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-2" style={{ borderTop: "1px solid rgba(245,237,224,0.1)" }}>
          <div className="mono text-[11px] tracking-widest mt-3 mb-1.5" style={{ color: PALETTE.gold }}>FIX THE POSTER</div>
          <div className="flex items-center gap-2">
            <input
              value={posterDraft} onChange={(e) => setPosterDraft(e.target.value)}
              placeholder="Paste a direct image URL"
              className="flex-1 px-3 py-1.5 rounded-md text-sm bg-black/30 outline-none text-amber-50 placeholder:text-amber-100/30"
            />
            <a href={googleImagesSearchUrl(movie.title, movie.year)} target="_blank" rel="noopener noreferrer" className="mono text-[11px] shrink-0 px-2 py-1.5 rounded-md whitespace-nowrap" style={{ background: "rgba(255,200,87,0.12)", color: PALETTE.gold }}>
              🔍 Google Images
            </a>
            <button onClick={() => onUpdatePoster(posterDraft.trim())} className="mono text-xs shrink-0 px-3 py-1.5 rounded-md font-semibold" style={{ background: PALETTE.gold, color: PALETTE.ink }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="text-center py-14 rounded-xl" style={{ background: "rgba(20,20,32,0.35)", border: "1px dashed rgba(245,237,224,0.15)" }}>
      <Icon className="mx-auto mb-2" style={{ color: PALETTE.gold, opacity: 0.6 }} />
      <p className="text-sm text-amber-100/50 max-w-xs mx-auto">{text}</p>
    </div>
  );
}