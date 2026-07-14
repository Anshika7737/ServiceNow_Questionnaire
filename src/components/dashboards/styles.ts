const card =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]";

const input =
  "rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:shadow-none";

const select =
  `${input} cursor-pointer appearance-none pr-10`;

const btn =
  "rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60";

const btnSecondary =
  "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const tabTrack = "flex gap-1 rounded-xl bg-[var(--tab-track-bg)] p-1";

const tabButton =
  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--tab-inactive-text)] [&_svg]:text-[var(--tab-inactive-text)] focus:outline-none focus:shadow-none";

const tabButtonActive =
  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 bg-[var(--tab-active-bg)] text-sm font-semibold text-[var(--tab-active-text)] shadow-[var(--tab-active-shadow)] [&_svg]:text-[var(--tab-active-text)] focus:outline-none focus:shadow-none";

const sectionIcon =
  "rounded-xl bg-[var(--accent-subtle)] p-2.5 text-[var(--accent)]";

export { card, input, select, btn, btnSecondary, tabTrack, tabButton, tabButtonActive, sectionIcon };
