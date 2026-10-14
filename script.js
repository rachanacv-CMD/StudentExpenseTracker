const STORAGE_KEY = "studentExpenseTrackerData";
const CATEGORY_LABELS = {
  food: "Food",
  transport: "Transportation",
  books: "Books & supplies",
  housing: "Housing",
  entertainment: "Entertainment",
  other: "Other",
};

const budgetForm = document.querySelector("#budget-form");
const budgetInput = document.querySelector("#budget-amount");
const expenseForm = document.querySelector("#expense-form");
const descriptionInput = document.querySelector("#expense-description");
const categoryInput = document.querySelector("#expense-category");
const amountInput = document.querySelector("#expense-amount");
const dateInput = document.querySelector("#expense-date");
const expenseList = document.querySelector("#expense-list");
const totalBudgetOutput = document.querySelector("#total-budget");
const totalSpentOutput = document.querySelector("#total-spent");
const remainingBudgetOutput = document.querySelector("#remaining-budget");
const appMessage = document.querySelector("#app-message");

const today = new Date();
dateInput.value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

let state = loadState();
render();

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const amountCents = parseAmountInCents(budgetInput.value, true);
  if (amountCents === null) {
    showMessage("Enter a valid budget amount of zero or more.", true);
    budgetInput.focus();
    return;
  }

  state.budgetCents = amountCents;
  const saved = persistState();
  render();
  if (saved) {
    showMessage("Monthly budget updated.");
  }
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const category = categoryInput.value;
  const amountCents = parseAmountInCents(amountInput.value, false);
  const expenseDate = dateInput.value;

  if (!description) {
    showMessage("Enter a description for this expense.", true);
    descriptionInput.focus();
    return;
  }
  if (description.length > 100) {
    showMessage("Descriptions must be 100 characters or fewer.", true);
    descriptionInput.focus();
    return;
  }
  if (!Object.hasOwn(CATEGORY_LABELS, category)) {
    showMessage("Choose a valid expense category.", true);
    categoryInput.focus();
    return;
  }
  if (amountCents === null) {
    showMessage("Enter an expense amount greater than zero.", true);
    amountInput.focus();
    return;
  }
  if (!isValidDate(expenseDate)) {
    showMessage("Choose a valid expense date.", true);
    dateInput.focus();
    return;
  }
  const spentCents = getTotalSpentCents();
  if (amountCents > Number.MAX_SAFE_INTEGER - spentCents) {
    showMessage("The expense would make your total too large to calculate safely.", true);
    amountInput.focus();
    return;
  }

  state.expenses.push({
    id: createExpenseId(),
    description,
    category,
    amountCents,
    date: expenseDate,
  });
  const saved = persistState();
  render();
  expenseForm.reset();
  dateInput.value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  descriptionInput.focus();
  if (saved) {
    showMessage("Expense added.");
  }
});

expenseList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("button[data-expense-id]");
  if (!deleteButton) {
    return;
  }

  state.expenses = state.expenses.filter((expense) => expense.id !== deleteButton.dataset.expenseId);
  const saved = persistState();
  render();
  if (saved) {
    showMessage("Expense deleted.");
  }
});

function parseAmountInCents(value, allowZero) {
  if (value.trim() === "") {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) {
    return null;
  }

  const cents = Math.round((amount + Number.EPSILON) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function createExpenseId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isStoredExpense(value) {
  return value !== null
    && typeof value === "object"
    && typeof value.id === "string"
    && typeof value.description === "string"
    && value.description.trim().length > 0
    && value.description.length <= 100
    && Object.hasOwn(CATEGORY_LABELS, value.category)
    && Number.isSafeInteger(value.amountCents)
    && value.amountCents > 0
    && isValidDate(value.date);
}

function loadState() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (storedValue === null) {
      return { budgetCents: 0, expenses: [] };
    }

    const parsed = JSON.parse(storedValue);
    if (
      parsed === null
      || !Number.isSafeInteger(parsed.budgetCents)
      || parsed.budgetCents < 0
      || !Array.isArray(parsed.expenses)
      || !parsed.expenses.every(isStoredExpense)
      || !Number.isSafeInteger(parsed.expenses.reduce(
        (total, expense) => total + expense.amountCents,
        0,
      ))
    ) {
      throw new Error("Saved tracker data has an invalid format.");
    }

    return { budgetCents: parsed.budgetCents, expenses: parsed.expenses };
  } catch (error) {
    console.error("Unable to load saved expense tracker data.", error);
    showMessage("Saved data could not be loaded. The tracker is starting with an empty record.", true);
    return { budgetCents: 0, expenses: [] };
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Unable to save expense tracker data.", error);
    showMessage("Changes are active, but could not be saved in this browser.", true);
    return false;
  }
}

function render() {
  const totalSpentCents = getTotalSpentCents();

  totalBudgetOutput.textContent = formatCurrency(state.budgetCents);
  totalSpentOutput.textContent = formatCurrency(totalSpentCents);
  remainingBudgetOutput.textContent = formatCurrency(state.budgetCents - totalSpentCents);

  expenseList.replaceChildren();
  if (state.expenses.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.id = "empty-state";
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 5;
    emptyCell.textContent = "No expenses yet. Add your first expense above.";
    emptyRow.append(emptyCell);
    expenseList.append(emptyRow);
    return;
  }

  [...state.expenses]
    .sort((first, second) => second.date.localeCompare(first.date))
    .forEach((expense) => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      const descriptionCell = document.createElement("td");
      const categoryCell = document.createElement("td");
      const amountCell = document.createElement("td");
      const actionCell = document.createElement("td");
      const deleteButton = document.createElement("button");

      dateCell.textContent = formatDate(expense.date);
      descriptionCell.textContent = expense.description;
      categoryCell.textContent = CATEGORY_LABELS[expense.category];
      amountCell.textContent = formatCurrency(expense.amountCents);
      deleteButton.type = "button";
      deleteButton.className = "delete-expense";
      deleteButton.dataset.expenseId = expense.id;
      deleteButton.setAttribute("aria-label", `Delete expense: ${expense.description}`);
      deleteButton.textContent = "Delete";
      actionCell.append(deleteButton);
      row.append(dateCell, descriptionCell, categoryCell, amountCell, actionCell);
      expenseList.append(row);
    });
}

function getTotalSpentCents() {
  return state.expenses.reduce((total, expense) => total + expense.amountCents, 0);
}

function formatCurrency(amountCents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function showMessage(message, isError = false) {
  appMessage.textContent = message;
  appMessage.dataset.error = String(isError);
}