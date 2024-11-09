import { faker } from 'https://esm.sh/@faker-js/faker';
const { createClient } = supabase;
const url = '';
const key = '';
const supaClient = createClient(url, key);
window.deleteAtId = deleteAtId;
// html elements
const whenSignedOutSection = document.querySelector('.whenSignedOut');
const loginButton = document.getElementById('signInBtn');
const whenSignedInSection = document.querySelector('.whenSignedIn');
const userDetails = document.getElementById('userDetails');
const logoutButton = document.getElementById('signOutBtn');
const myThingsSection = document.getElementById('myThings');
const myThingsList = document.getElementById('myThingsList');
const createThing = document.getElementById('createThing');
const allThingsSection = document.getElementById('allThings');
const allThingsList = document.getElementById('allThingsList');

// Event listeners
loginButton.addEventListener('click', () => {
  supaClient.auth.signInWithOAuth({
    provider: 'google',
  });
});

logoutButton.addEventListener('click', () => {
  supaClient.auth.signOut();
});

supaClient.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    adjustForUser(session.user);
  } else {
    adjustForNoUser();
  }
});

createThing.addEventListener('click', async () => {
  const {
    data: { user },
  } = await supaClient.auth.getUser();
  const thing = createRandomThing(user);
  await supaClient.from('things').insert([thing]);
});

// init
checkUserOnStartup();
let myThingsSubscription;
const myThings = {};
const allThings = {};
getAllInitialThings().then(() => listenToAllThings());
// getMyInitialThings().then(() => listenToAllThings());
const trashIcon = '🗑️';
// function declarations
async function checkUserOnStartup() {
  const {
    data: { user },
  } = await supaClient.auth.getUser();
  if (user) {
    adjustForUser(user);
  } else {
    adjustForNoUser();
  }
}

async function adjustForUser(user) {
  whenSignedInSection.hidden = false;
  myThingsSection.hidden = false;
  whenSignedOutSection.hidden = true;
  userDetails.innerHTML = `
  <h3>Hi ${user.user_metadata.full_name}</h3>
  <img src="${user.user_metadata.avatar_url}"/>
  <p>UID: ${user.id}</p>
  `;
  await getMyInitialThings(user);
  await listenToMyThingsChange(user);
}

function adjustForNoUser() {
  whenSignedOutSection.hidden = false;
  whenSignedInSection.hidden = true;
  myThingsSection.hidden = true;
  if (myThingsSubscription) {
    myThingsSubscription.unsubscribe();
    myThingsSubscription = null;
  }
}

async function getAllInitialThings() {
  const { data } = await supaClient.from('things').select();
  for (const thing of data) {
    allThings[thing.id] = thing;
  }
  renderAllThings();
}

function renderAllThings() {
  const tableHeader = `
  <thead>
  <th>Name</th>
  <th>Weight</th>
  </thead>
  `;
  const tableBody = Object.values(allThings)
    .sort((a, b) => (a.weight > b.weight ? -1 : 1))
    .map((thing) => {
      return `<tr>
                <td>${thing.name}</td>
                <td>${thing.weight}</td>
                </tr>`;
    })
    .join('');
  const table = `
  <table class='table table-striped'>
    ${tableHeader}
    ${tableBody}
  </table>
  `;
  allThingsList.innerHTML = table;
}

function createRandomThing(user) {
  if (!user) {
    console.error('User must be signed in');
    return;
  }
  return {
    name: faker.commerce.productName(3),
    weight: Math.round(Math.random() * 100),
    owner: user.id,
  };
}

function handleAllThingsUpdate(update) {
  if (update.eventType === 'DELETE') {
    delete allThings[update.old.id];
  } else {
    allThings[update.new.id] = update.new;
  }
  renderAllThings();
  renderMyThings();
}

function listenToAllThings() {
  supaClient
    .channel('public:things')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'things' },
      handleAllThingsUpdate
    )
    .subscribe();
}

async function getMyInitialThings(user) {
  const { data } = await supaClient
    .from('things')
    .select('*')
    .eq('owner', user.id);
  for (const thing of data) {
    myThings[thing.id] = thing;
  }
  renderMyThings();
}
function handleMyThingsUpdate(update) {
  console.log(update);
  if (update.eventType === 'DELETE') {
    delete myThings[update.old.id];
  } else {
    myThings[update.new.id] = update.new;
  }
  renderMyThings();
}
async function listenToMyThingsChange(user) {
  if (myThingsSubscription) return;
  myThingsSubscription = supaClient
    .channel(`public:things:owner=eq.${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'things',
        filter: `owner=eq.${user.id}`,
      },
      handleMyThingsUpdate
    )
    .subscribe();
  console.log('Subscription done');
}
function renderMyThings() {
  console.log(`Rendering my things`);
  const tableHeader = `
  <thead>
  <th>Name</th>
  <th>Weight</th>
  <th>Delete</th>
  </thead>
  `;
  const tableBody = Object.values(myThings)
    .sort((a, b) => (a.weight > b.weight ? -1 : 1))
    .map((thing) => {
      return `<tr>
                <td>${thing.name}</td>
                <td>${thing.weight}</td>
                <td>${deleteButtonTemplate(thing)}</td>
                </tr>`;
    })
    .join('');
  const table = `
  <table class='table table-striped'>
    ${tableHeader}
    ${tableBody}
  </table>
  `;
  myThingsList.innerHTML = table;
}
async function deleteAtId(id) {
  await supaClient.from('things').delete().eq('id', id);
}

function deleteButtonTemplate(thing) {
  return `
  <button onclick="deleteAtId(${thing.id})" class="btn btn-outline-danger">${trashIcon}</button>
  `;
}
