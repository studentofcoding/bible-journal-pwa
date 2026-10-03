import { useRef } from 'react';
import type { Entry } from '../hooks/useJournalStore';
import { lookupVerse } from '../lib/verses';

export type PageSide = 'left' | 'right';

interface PageProps {
  entry: Entry;
  index: number;
  side: PageSide;
  onChange: (index: number, patch: { ref?: string; text?: string }) => void;
  onActivate: (index: number) => void;
  onCaret: (y: number) => void;
  onTyping: () => void;
}

/** Measures the caret's vertical offset (design px) inside a textarea using a hidden mirror element. */
function caretOffset(ta: HTMLTextAreaElement): number {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement('div');
  const s = mirror.style;
  s.position = 'absolute'; s.visibility = 'hidden'; s.top = '-9999px'; s.left = '-9999px';
  s.whiteSpace = 'pre-wrap'; s.wordWrap = 'break-word'; s.boxSizing = 'border-box';
  s.width = `${ta.clientWidth}px`;
  s.font = cs.font; s.letterSpacing = cs.letterSpacing; s.lineHeight = cs.lineHeight;
  s.padding = cs.padding;
  mirror.textContent = ta.value.slice(0, ta.selectionStart ?? 0);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const y = marker.offsetTop - ta.scrollTop;
  mirror.remove();
  return y;
}

const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** One journal page: scripture reference, optional KJV quote, and a lined reflection area. */
export function Page({ entry, index, side, onChange, onActivate, onCaret, onTyping }: PageProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const quote = lookupVerse(entry.ref);

  const reportCaret = () => {
    const ta = taRef.current;
    if (ta) onCaret(ta.offsetTop + caretOffset(ta));
  };

  return (
    <article className={`page ${side}`} data-page={index} onFocusCapture={() => onActivate(index)}>
      <header className="page-head">
        <span className="page-no">№ {index + 1}</span>
        <time dateTime={new Date(entry.updatedAt).toISOString()}>{fmt.format(entry.updatedAt)}</time>
      </header>
      <label className="visually-hidden" htmlFor={`ref-${entry.id}`}>Scripture reference</label>
      <input
        id={`ref-${entry.id}`}
        className="page-ref"
        value={entry.ref}
        placeholder="Scripture reference, e.g. John 3:16"
        list="verse-suggestions"
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="next"
        onChange={(e) => { onChange(index, { ref: e.target.value }); onTyping(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); taRef.current?.focus(); } }}
      />
      {quote && <blockquote className="page-quote">“{quote.text}” <cite>KJV</cite></blockquote>}
      <label className="visually-hidden" htmlFor={`txt-${entry.id}`}>Reflection</label>
      <textarea
        id={`txt-${entry.id}`}
        ref={taRef}
        className="page-lines"
        value={entry.text}
        placeholder="What is the passage saying? What stands out to you today?"
        onChange={(e) => { onChange(index, { text: e.target.value }); onTyping(); reportCaret(); }}
        onSelect={reportCaret}
        onFocus={reportCaret}
      />
    </article>
  );
}

export function BlankPage({ index, side, onAdd }: { index: number; side: PageSide; onAdd?: () => void }) {
  return (
    <article className={`page blank ${side}`} aria-label="Blank page">
      <header className="page-head"><span className="page-no">№ {index + 1}</span></header>
      {onAdd ? (
        <button type="button" className="page-add" onClick={onAdd}>
          <span aria-hidden="true">＋</span> Begin a new page
        </button>
      ) : null}
    </article>
  );
}
