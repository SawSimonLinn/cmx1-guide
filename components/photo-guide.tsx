'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

const photos = [
  ['A-frame sign', 'Show the A-frame sign posted outside the store.'],
  ['Sushi variety', 'Show the different varieties of sushi packages available.'],
  ['Promotional item', 'Photograph the promotional item with its sticker on the display case.'],
  ['Marketing sticker', 'Show the marketing sticker on the sneeze guard.'],
  ['Product labels', 'Take close-up photos with allergen and ingredient information clearly readable.'],
  ['Sushi quality', 'Take clear photos showing the quality and presentation of the sushi.'],
  ['Chef uniform', 'Photograph the chef wearing the full uniform.'],
  ['Logbooks', 'Photograph multiple pages of the logbooks so the entries are readable.'],
  ['Produce or receipt', 'Photograph the cucumber and avocado, or the produce receipt.'],
  ['Display case size', 'Take a full side view of the display cases to show their size.'],
];

export function PhotoGuide() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return <>
    <button type="button" className="photo-guide-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog"><Camera size={16}/> Photo guide</button>
    <dialog ref={dialog} className="photo-guide-dialog" aria-labelledby="photo-guide-title" aria-describedby="photo-guide-description" onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false); } }}>
      <header className="photo-guide-header"><div><h2 id="photo-guide-title">Store visit photo guide</h2><p id="photo-guide-description">Take these photos during your visit for this report.</p></div><button type="button" className="icon-button" aria-label="Close photo guide" onClick={() => setOpen(false)} autoFocus><X size={20}/></button></header>
      <ol className="photo-guide-list">{photos.map(([title, description]) => <li key={title}><strong>{title}</strong><p>{description}</p></li>)}</ol>
      <footer className="photo-guide-footer"><button type="button" className="primary" onClick={() => setOpen(false)}>Done</button></footer>
    </dialog>
  </>;
}
