const DB_NAME = 'macroflow';
const DB_VERSION = 3;
let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('meals')) {
        const store = database.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
        store.createIndex('ts', 'ts');
      }
      if (!database.objectStoreNames.contains('weights')) database.createObjectStore('weights', { keyPath: 'id', autoIncrement: true });
      if (!database.objectStoreNames.contains('activities')) database.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function getMeals(from = 0, to = Date.now() + 1) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('meals').objectStore('meals').getAll();
    request.onsuccess = () => resolve(request.result.filter(meal => meal.ts >= from && meal.ts < to).sort((a, b) => a.ts - b.ts));
    request.onerror = () => reject(request.error);
  });
}

export async function getAllMeals() { return getMeals(0, Number.MAX_SAFE_INTEGER); }

export async function addMeal(meal) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('meals', 'readwrite').objectStore('meals').add({ ts: Date.now(), category: 'Drugo', ...meal });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMeal(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('meals', 'readwrite').objectStore('meals').delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function updateMeal(id, meal) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('meals', 'readwrite').objectStore('meals').put({ id, ...meal });
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function importMeals(meals) {
  const existing = await getAllMeals();
  if (existing.length || !meals.length) return false;
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('meals', 'readwrite');
    const store = transaction.objectStore('meals');
    meals.forEach(meal => store.add({ category: 'Drugo', ...meal }));
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function addWeight(kg) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('weights', 'readwrite').objectStore('weights').add({ ts: Date.now(), kg: Number(kg) });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getWeights() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('weights').objectStore('weights').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.ts - b.ts));
    request.onerror = () => reject(request.error);
  });
}

export async function addActivity(activity) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('activities', 'readwrite').objectStore('activities').add({ ts: Date.now(), ...activity });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getActivities() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const request = database.transaction('activities').objectStore('activities').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.ts - a.ts));
    request.onerror = () => reject(request.error);
  });
}

export async function restoreBackup(data) {
  const database = await openDB();
  const stores = ['meals', 'weights', 'activities'];
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, 'readwrite');
    stores.forEach(name => transaction.objectStore(name).clear());
    (data.meals || []).forEach(item => { const { id, ...copy } = item; transaction.objectStore('meals').add(copy); });
    (data.weights || []).forEach(item => { const { id, ...copy } = item; transaction.objectStore('weights').add(copy); });
    (data.activities || []).forEach(item => { const { id, ...copy } = item; transaction.objectStore('activities').add(copy); });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
