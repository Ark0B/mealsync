// Renders the weekly menu as a table (used by the student and committee pages).
window.renderMenuTable = (items, { highlightDay } = {}) => {
  const { esc, MEALS } = MealSync;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cell = (d, m) => ['veg', 'nonveg'].map((diet) => {
    const it = items.find((i) => i.day_of_week === d && i.meal === m && i.diet === diet);
    return it ? `<div><span class="tag ${diet}">${diet === 'veg' ? 'V' : 'NV'}</span> ${esc(it.items)}</div>` : '';
  }).join('');
  let html = '<table><thead><tr><th>Day</th>';
  Object.values(MEALS).forEach((n) => { html += `<th>${n}</th>`; });
  html += '</tr></thead><tbody>';
  for (let d = 0; d < 7; d += 1) {
    html += `<tr${d === highlightDay ? ' style="background:#f1f7f3"' : ''}><td><b>${days[d]}</b></td>`;
    Object.keys(MEALS).forEach((m) => { html += `<td>${cell(d, m)}</td>`; });
    html += '</tr>';
  }
  return `${html}</tbody></table>`;
};
