import { addActivity, addMeal, addWeight, deleteMeal, getActivities, getAllMeals, getWeights, importMeals, restoreBackup, updateMeal } from './db.js';
import { FOODS } from './foods.js';

const DEFAULT_GOALS = { kcal: 2200, p: 160, c: 250, f: 70 };
const state = { meals: [], weights: [], activities: [], recipes: loadRecipes(), customFoods: loadCustomFoods(), profile: loadProfile(), goals: loadGoals(), water: loadWater(), selectedDate: dateKey(new Date()) };
const $ = id => document.getElementById(id);
function dateKey(date) { return date.toISOString().slice(0, 10); }
function loadGoals() { try { return { ...DEFAULT_GOALS, ...JSON.parse(localStorage.getItem('macroflow-goals') || '{}') }; } catch { return { ...DEFAULT_GOALS }; } }
function saveGoals() { localStorage.setItem('macroflow-goals', JSON.stringify(state.goals)); }
function loadProfile() { try { return JSON.parse(localStorage.getItem('macroflow-profile') || '{}'); } catch { return {}; } }
function saveProfile() { localStorage.setItem('macroflow-profile', JSON.stringify(state.profile)); }
function loadWater() { try { return JSON.parse(localStorage.getItem('macroflow-water') || '{}'); } catch { return {}; } }
function saveWater() { localStorage.setItem('macroflow-water', JSON.stringify(state.water)); }
function loadRecipes() { try { return JSON.parse(localStorage.getItem('macroflow-recipes') || '[]'); } catch { return []; } }
function saveRecipes() { localStorage.setItem('macroflow-recipes', JSON.stringify(state.recipes)); }
function loadCustomFoods() { try { return JSON.parse(localStorage.getItem('macroflow-custom-foods') || '[]'); } catch { return []; } }
function allFoods() { return [...FOODS, ...state.customFoods]; }
function saveCustomFoods() { localStorage.setItem('macroflow-custom-foods', JSON.stringify(state.customFoods)); }
function sum(meals) { return meals.reduce((total, meal) => { total.kcal += Number(meal.kcal) || 0; total.p += Number(meal.p) || 0; total.c += Number(meal.c) || 0; total.f += Number(meal.f) || 0; return total; }, { kcal: 0, p: 0, c: 0, f: 0 }); }
function esc(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }

function renderOverview() {
  const totals = sum(state.meals.filter(meal => dateKey(new Date(meal.ts)) === state.selectedDate));
  ['kcal', 'p', 'c', 'f'].forEach(key => { $(`${key}-val`).textContent = key === 'kcal' ? Math.round(totals[key]) : `${Math.round(totals[key])} g`; $(`${key}-goal`).textContent = `od ${state.goals[key]}${key === 'kcal' ? '' : ' g'}`; });
  const progress = Math.min(100, totals.kcal / state.goals.kcal * 100);
  $('kcal-progress').parentElement.style.background = `conic-gradient(var(--primary) 0 ${progress}%, #24344c ${progress}% 100%)`;
  $('date-label').textContent = state.selectedDate === dateKey(new Date()) ? 'Danes' : new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString('sl-SI');
  renderMealList('today-meals', state.meals.filter(meal => dateKey(new Date(meal.ts)) === state.selectedDate));
}
function renderMealList(target, meals) {
  const element = $(target);
  if (!meals.length) { element.innerHTML = '<p class="muted">Še ni vnesenih obrokov.</p>'; return; }
  const groups = ['Zajtrk', 'Kosilo', 'Večerja', 'Prigrizek', 'Drugo'];
  element.innerHTML = groups.filter(group => meals.some(meal => (meal.category || 'Drugo') === group)).map(group => `<section class="meal-group"><h4>${group}</h4>${meals.filter(meal => (meal.category || 'Drugo') === group).map(meal => `<div class="meal-item"><div><strong>${esc(meal.name)}</strong><small>${new Date(meal.ts).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })} · ${meal.kcal} kcal</small></div><div class="meal-macros">P ${meal.p} · OH ${meal.c} · M ${meal.f}<button class="edit" data-edit="${meal.id}" aria-label="Uredi obrok">✎</button><button class="repeat" data-repeat="${meal.id}" aria-label="Ponovi obrok">↻</button><button class="delete" data-delete="${meal.id}" aria-label="Izbriši obrok">×</button></div></div>`).join('')}</section>`).join('');
}
function renderHistory() {
  const byDay = {};
  state.meals.forEach(meal => { const key = dateKey(new Date(meal.ts)); (byDay[key] ||= []).push(meal); });
  $('history-list').innerHTML = Object.keys(byDay).sort().reverse().map(key => { const totals = sum(byDay[key]); return `<button class="history-row" data-date="${key}"><span>${new Date(`${key}T12:00:00`).toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short' })}</span><strong>${Math.round(totals.kcal)} kcal</strong><small>P ${Math.round(totals.p)} · OH ${Math.round(totals.c)} · M ${Math.round(totals.f)} g</small></button>`; }).join('') || '<p class="muted">Zgodovina bo prikazana po prvem vnosu.</p>';
}
function renderGoals() { ['kcal', 'p', 'c', 'f'].forEach(key => { $(`goal-${key}`).value = state.goals[key]; }); }
function renderProfile() { ['sex', 'age', 'height', 'weight', 'activity', 'direction'].forEach(key => { const element = $(`profile-${key}`); if (element && state.profile[key] !== undefined) element.value = state.profile[key]; }); }
function renderProgress() {
  const latest = state.weights.at(-1);
  $('current-weight').textContent = latest ? `${latest.kg.toFixed(1)} kg` : '—';
  let chart = $('weight-chart'); if (!chart) { chart = document.createElement('div'); chart.id = 'weight-chart'; chart.style.cssText = 'height:90px;display:flex;align-items:end;gap:5px;border-bottom:1px solid #22304a;margin:16px 0;padding:0 4px'; $('weight-history').before(chart); } const recentWeights = state.weights.slice(-14); const minWeight = Math.min(...recentWeights.map(item => item.kg), 0); const maxWeight = Math.max(...recentWeights.map(item => item.kg), 1); chart.innerHTML = recentWeights.map(item => `<div title="${item.kg.toFixed(1)} kg" style="height:${Math.max(8, (item.kg - minWeight) / Math.max(1, maxWeight - minWeight) * 100)}%;flex:1;min-width:5px;background:#3b82f6;border-radius:4px 4px 0 0"></div>`).join('') || '<span class="muted">Graf bo prikazan po meritvi.</span>';
  $('weight-history').innerHTML = state.weights.slice().reverse().map(weight => `<div class="progress-row"><span>${new Date(weight.ts).toLocaleDateString('sl-SI')}</span><strong>${weight.kg.toFixed(1)} kg</strong></div>`).join('') || '<p class="muted">Dodaj prvo meritev teže.</p>';
  $('activity-history').innerHTML = state.activities.map(activity => `<div class="progress-row"><span>${esc(activity.name)}<small>${new Date(activity.ts).toLocaleDateString('sl-SI')}</small></span><strong>${activity.minutes} min · ${activity.kcal} kcal</strong></div>`).join('') || '<p class="muted">Vadba še ni zabeležena.</p>';
}
function renderRecipes() {
  $('recipe-list').innerHTML = state.recipes.map((recipe, index) => `<div class="recipe-row"><div><strong>${esc(recipe.name)}</strong><small>${recipe.kcal} kcal · P ${recipe.p} · OH ${recipe.c} · M ${recipe.f}</small></div><button class="quick-add" data-recipe-index="${index}">Dodaj</button></div>`).join('') || '<p class="muted">Še nimaš shranjenih receptov.</p>';
}
function renderAnalytics() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() - 6 + index); const key = dateKey(date); const meals = state.meals.filter(meal => dateKey(new Date(meal.ts)) === key); return { key, label: date.toLocaleDateString('sl-SI', { weekday: 'short' }), ...sum(meals) }; });
  const max = Math.max(state.goals.kcal, ...days.map(day => day.kcal), 1);
  $('weekly-chart').innerHTML = days.map(day => `<div class="bar-column"><span>${Math.round(day.kcal)}</span><div class="bar-track"><i style="height:${Math.max(2, day.kcal / max * 100)}%"></i></div><small>${day.label}</small></div>`).join('');
  const total = days.reduce((result, day) => { result.kcal += day.kcal; result.p += day.p; result.c += day.c; result.f += day.f; return result; }, { kcal: 0, p: 0, c: 0, f: 0 });
  $('weekly-summary').textContent = `Povprečje: ${Math.round(total.kcal / 7)} kcal · P ${Math.round(total.p / 7)} g · OH ${Math.round(total.c / 7)} g · M ${Math.round(total.f / 7)} g`;
}
function renderHydration() { const amount = state.water[state.selectedDate] || 0; $('water-amount').textContent = `${amount} / 2000 ml`; $('water-progress').style.width = `${Math.min(100, amount / 2000 * 100)}%`; }
function renderFoods(query = '') {
  const normalized = query.trim().toLowerCase();
  const foods = allFoods().filter(food => food.name.toLowerCase().includes(normalized));
  $('food-results').innerHTML = foods.map((food, index) => `<button class="food-row" data-food-index="${index}"><span><strong>${esc(food.name)}</strong><small>${food.kcal} kcal · P ${food.p} · OH ${food.c} · M ${food.f} / ${food.unit}</small></span><b>＋</b></button>`).join('') || '<p class="muted">Ni zadetkov.</p>';
}
function renderAll() { renderOverview(); renderHistory(); renderGoals(); renderProfile(); renderProgress(); renderRecipes(); renderAnalytics(); renderHydration(); }
async function refresh() { [state.meals, state.weights, state.activities] = await Promise.all([getAllMeals(), getWeights(), getActivities()]); renderAll(); }

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.tab, .view').forEach(element => element.classList.remove('active')); tab.classList.add('active'); $(tab.dataset.target).classList.add('active'); }));
$('add-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const selectedTime = form.get('meal-time'); await addMeal({ ts: selectedTime ? new Date(selectedTime).getTime() : Date.now(), name: form.get('name'), category: form.get('category'), kcal: Number(form.get('kcal')) || 0, p: Number(form.get('p')) || 0, c: Number(form.get('c')) || 0, f: Number(form.get('f')) || 0 }); event.currentTarget.reset(); $('meal-time').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); await refresh(); document.querySelector('[data-target="pregled"]').click(); });
document.addEventListener('click', async event => { const button = event.target.closest('[data-delete]'); if (button && confirm('Ta obrok izbrišem?')) { await deleteMeal(Number(button.dataset.delete)); await refresh(); } const history = event.target.closest('[data-date]'); if (history) { state.selectedDate = history.dataset.date; renderOverview(); document.querySelector('[data-target="pregled"]').click(); } });
document.addEventListener('click', async event => { const button = event.target.closest('[data-repeat]'); if (!button) return; const meal = state.meals.find(item => item.id === Number(button.dataset.repeat)); if (meal) { const { id, ts, ...copy } = meal; await addMeal(copy); await refresh(); } });
document.addEventListener('click', async event => { const button = event.target.closest('[data-edit]'); if (!button) return; const meal = state.meals.find(item => item.id === Number(button.dataset.edit)); if (!meal) return; const name = prompt('Ime obroka:', meal.name); if (!name) return; const kcal = Number(prompt('Kalorije:', meal.kcal)); const p = Number(prompt('Beljakovine (g):', meal.p)); const c = Number(prompt('Ogljikovi hidrati (g):', meal.c)); const f = Number(prompt('Maščobe (g):', meal.f)); if ([kcal, p, c, f].some(value => !Number.isFinite(value) || value < 0)) { alert('Vrednosti morajo biti nenegativna števila.'); return; } await updateMeal(meal.id, { ...meal, name, kcal, p, c, f }); await refresh(); });
$('food-search').addEventListener('input', event => renderFoods(event.target.value));
document.addEventListener('click', async event => { const foodButton = event.target.closest('[data-food-index]'); if (!foodButton) return; const food = allFoods()[Number(foodButton.dataset.foodIndex)]; const amount = Number(prompt(`Količina za ${food.name} (${food.unit}):`, food.unit === 'kos' ? '1' : '100')); if (!amount || amount <= 0) return; const factor = food.unit === 'kos' ? amount : amount / 100; await addMeal({ name: `${food.name} (${amount}${food.unit === 'kos' ? ' kos' : ' g'})`, category: 'Drugo', kcal: Math.round(food.kcal * factor), p: Math.round(food.p * factor * 10) / 10, c: Math.round(food.c * factor * 10) / 10, f: Math.round(food.f * factor * 10) / 10 }); await refresh(); document.querySelector('[data-target="pregled"]').click(); });
$('custom-food-form').addEventListener('submit', event => { event.preventDefault(); const food = { name: $('custom-food-name').value, kcal: Number($('custom-food-kcal').value) || 0, p: Number($('custom-food-p').value) || 0, c: Number($('custom-food-c').value) || 0, f: Number($('custom-food-f').value) || 0, unit: '100 g' }; state.customFoods.push(food); saveCustomFoods(); event.currentTarget.reset(); renderFoods($('food-search').value); alert('Živilo shranjeno.'); });
$('date-prev').addEventListener('click', () => { const date = new Date(`${state.selectedDate}T12:00:00`); date.setDate(date.getDate() - 1); state.selectedDate = dateKey(date); renderOverview(); });
$('date-next').addEventListener('click', () => { const date = new Date(`${state.selectedDate}T12:00:00`); date.setDate(date.getDate() + 1); state.selectedDate = dateKey(date); renderOverview(); });
$('water-add').addEventListener('click', event => { state.water[state.selectedDate] = (state.water[state.selectedDate] || 0) + Number(event.target.dataset.ml); saveWater(); renderHydration(); });
$('goals-form').addEventListener('submit', event => { event.preventDefault(); ['kcal', 'p', 'c', 'f'].forEach(key => { state.goals[key] = Number($(`goal-${key}`).value) || DEFAULT_GOALS[key]; }); saveGoals(); renderOverview(); alert('Cilji shranjeni.'); });
$('profile-form').addEventListener('submit', event => { event.preventDefault(); state.profile = { sex: $('profile-sex').value, age: Number($('profile-age').value), height: Number($('profile-height').value), weight: Number($('profile-weight').value), activity: Number($('profile-activity').value), direction: Number($('profile-direction').value) }; const base = state.profile.sex === 'female' ? 10 * state.profile.weight + 6.25 * state.profile.height - 5 * state.profile.age - 161 : 10 * state.profile.weight + 6.25 * state.profile.height - 5 * state.profile.age + 5; state.goals.kcal = Math.max(1200, Math.round(base * state.profile.activity + state.profile.direction)); state.goals.p = Math.round(state.profile.weight * 1.6); state.goals.f = Math.round(state.profile.weight * 0.8); state.goals.c = Math.max(0, Math.round((state.goals.kcal - state.goals.p * 4 - state.goals.f * 9) / 4)); saveProfile(); saveGoals(); renderAll(); alert(`Ocenjeni dnevni cilj: ${state.goals.kcal} kcal.`); });
$('weight-form').addEventListener('submit', async event => { event.preventDefault(); await addWeight($('weight-kg').value); event.currentTarget.reset(); await refresh(); });
$('activity-form').addEventListener('submit', async event => { event.preventDefault(); await addActivity({ name: $('activity-name').value, minutes: Number($('activity-minutes').value) || 0, kcal: Number($('activity-kcal').value) || 0 }); event.currentTarget.reset(); await refresh(); });
$('recipe-form').addEventListener('submit', event => { event.preventDefault(); const recipe = { name: $('recipe-name').value, kcal: Number($('recipe-kcal').value) || 0, p: Number($('recipe-p').value) || 0, c: Number($('recipe-c').value) || 0, f: Number($('recipe-f').value) || 0 }; state.recipes.push(recipe); saveRecipes(); event.currentTarget.reset(); renderRecipes(); });
document.addEventListener('click', async event => { const button = event.target.closest('[data-recipe-index]'); if (!button) return; const recipe = state.recipes[Number(button.dataset.recipeIndex)]; if (recipe) { await addMeal({ ...recipe, category: 'Drugo' }); await refresh(); document.querySelector('[data-target="pregled"]').click(); } });
$('export-csv').addEventListener('click', () => { const header = 'datum,ura,obrok,kategorija,kcal,beljakovine_g,ogljikovi_hidrati_g,mascobe_g'; const rows = state.meals.map(meal => [new Date(meal.ts).toLocaleDateString('sl-SI'), new Date(meal.ts).toLocaleTimeString('sl-SI'), meal.name, meal.category || 'Drugo', meal.kcal, meal.p, meal.c, meal.f].map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')); const blob = new Blob([`${header}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `macroflow-${dateKey(new Date())}.csv`; link.click(); URL.revokeObjectURL(link.href); });
$('export-json').addEventListener('click', () => { const backup = { version: 1, exportedAt: new Date().toISOString(), meals: state.meals, weights: state.weights, activities: state.activities, recipes: state.recipes, customFoods: state.customFoods, profile: state.profile, goals: state.goals, water: state.water }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `macroflow-backup-${dateKey(new Date())}.json`; link.click(); URL.revokeObjectURL(link.href); });
$('import-json').addEventListener('change', async event => { const file = event.target.files[0]; if (!file || !confirm('Obnovitev bo zamenjala trenutne lokalne podatke. Nadaljujem?')) return; try { const backup = JSON.parse(await file.text()); await restoreBackup(backup); state.recipes = backup.recipes || []; state.customFoods = backup.customFoods || []; state.profile = backup.profile || {}; state.goals = { ...DEFAULT_GOALS, ...(backup.goals || {}) }; state.water = backup.water || {}; saveRecipes(); saveCustomFoods(); saveProfile(); saveGoals(); await refresh(); alert('Varnostna kopija je obnovljena.'); } catch (error) { alert('Datoteka ni veljavna varnostna kopija MACRO·FLOW.'); console.error(error); } event.target.value = ''; });

async function init() { try { const response = await fetch(`./meals.json?t=${Date.now()}`); if (response.ok) await importMeals(await response.json()); } catch (error) { console.warn('Začetnih podatkov ni bilo mogoče uvoziti:', error); } renderFoods(); await refresh(); }
const mealTime = $('meal-time'); if (mealTime) mealTime.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('PWA registracija ni uspela:', error)));
init();
