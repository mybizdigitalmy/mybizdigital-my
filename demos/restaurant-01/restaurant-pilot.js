/* DESIGN-001: Restaurant concept interactions only; no storage, network or real bookings. */
(() => {
  'use strict';
  const menu = document.getElementById('restaurant-menu-type');
  const menuRows = document.getElementById('restaurant-menu-rows');
  const sampleMenus = {
    tasting: [
      ['First course', 'Garden vegetables, citrus and herbs'],
      ['From the kitchen', 'The daily market selection'],
      ['A sweet finish', 'A thoughtful final moment']
    ],
    alacarte: [
      ['To begin', 'Garden greens, herbs and citrus'],
      ['From the kitchen', 'A seasonal market-inspired plate'],
      ['Something sweet', 'A light, leisurely finish']
    ],
    private: [
      ['Welcome course', 'A shared seasonal introduction'],
      ['The table', 'An illustrative chef-selected centrepiece'],
      ['To finish', 'Dessert for an unhurried gathering']
    ]
  };
  function updateMenu() {
    if (!menu || !menuRows) return;
    const selected = sampleMenus[menu.value] || sampleMenus.tasting;
    menuRows.replaceChildren(...selected.map(([title, desc]) => {
      const row = document.createElement('div');
      row.className = 'special-row';
      const label = document.createElement('b');
      const description = document.createElement('em');
      label.textContent = title;
      description.textContent = desc;
      row.append(label, description);
      return row;
    }));
  }
  menu?.addEventListener('change', updateMenu);
  const previewButton = document.getElementById('restaurant-preview-show');
  const result = document.getElementById('restaurant-preview-result');
  previewButton?.addEventListener('click', () => {
    const date = document.getElementById('restaurant-preview-date')?.value;
    const party = document.getElementById('restaurant-preview-party')?.value;
    const time = document.getElementById('restaurant-preview-time')?.value;
    if (!result) return;
    if (!date) {
      result.textContent = 'Choose a sample date to explore the preview. No booking will be made.';
      return;
    }
    const formatted = new Date(date + 'T12:00:00');
    if (Number.isNaN(formatted.getTime())) {
      result.textContent = 'Please choose a valid sample date.';
      return;
    }
    const label = new Intl.DateTimeFormat('en-MY', {dateStyle:'medium'}).format(formatted);
    result.textContent = `Preview selection: ${party} guest${party === '1' ? '' : 's'} · ${label} · ${time}. Illustrative only: no availability has been checked and no booking is created.`;
  });
})();
