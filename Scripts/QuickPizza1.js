import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3333";

// Multi-scenario test configuration:
export const options = {
  // https://grafana.com/docs/k6/latest/using-k6/scenarios/
  scenarios: {
    // Smoke load test: https://grafana.com/blog/2024/01/30/smoke-testing/
    smoke: {
      exec: "getPizza",           // Nombre de la función exportada a ejecutar
      executor: "constant-vus",   // Mantiene VUs constantes
      vus: 1,
      duration: "10s",
    },
    stress: {
      exec: "getPizza",
      executor: "ramping-vus",    // Escala VUs según stages
      stages: [
        { duration: "5s", target: 5 },  // Ramp-up: 0→5 VUs
        { duration: "360s", target: 5 }, // Steady: mantener 5 VUs
        { duration: "5s", target: 0 },  // Ramp-down: 5→0 VUs
      ],
      startTime: "10s", // Arranca cuando termina el smoke (10s)
    },
  },
  thresholds: {
    // Confiabilidad (todas las peticiones)
    http_req_failed: ["rate<0.01"],
    // Rendimiento (todas las peticiones)
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    // Métrica de aplicación
    quickpizza_ingredients: [{ threshold: "avg<8", abortOnFail: false }],
    // Validaciones (sin espacios)
    checks: ["rate>0.95"],
  },
};

// Custom metrics:
const pizzas = new Counter("quickpizza_number_of_pizzas");
const ingredients = new Trend("quickpizza_ingredients");

// Iniciar SharedArray en el contexto de init (se carga una vez por proceso)
const tokens = new SharedArray("all tokens", function () {
  const data = JSON.parse(open("./data/tokens.json"));
  return data.tokens || [];
});

// Exported function to be executed in the scenarios
export function getPizza() {
  // Seleccionar token aleatorio por iteración (si hay)
  const selectedToken =
    tokens.length > 0 ? tokens[Math.floor(Math.random() * tokens.length)] : null;

  const restrictions = {
    maxCaloriesPerSlice: 500,
    mustBeVegetarian: false,
    excludedIngredients: ["pepperoni"],
    excludedTools: ["knife"],
    maxNumberOfToppings: 6,
    minNumberOfToppings: 2,
  };

  const headers = {
    "Content-Type": "application/json",
    ...(selectedToken ? { Authorization: `token ${selectedToken}` } : {}),
    // Si tu API usa Bearer, cambia la línea anterior por:
    // Authorization: `Bearer ${selectedToken}`,
  };

  const res = http.post(
    `${BASE_URL}/api/pizza`,
    JSON.stringify(restrictions),
    { headers }
  );

  // Validaciones
  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  // Manejo seguro del body
  const body = res.json();
  const pizzaData = body?.pizza;
  const ingredientCount = pizzaData?.ingredients?.length ?? 0;
  const pizzaName = pizzaData?.name ?? "(unknown)";

  // Métricas personalizadas
  pizzas.add(1);
  ingredients.add(ingredientCount);

  // Logs legibles
  console.log(`${pizzaName} (${ingredientCount} ingredients)`);
  if (selectedToken) {
    console.log(
      `pizza [Token: ${String(selectedToken).substring(0, 8)}...] ${pizzaName} (${ingredientCount} Ingredientes)`
    );
  }

  // Simular think time
  sleep(1);
}

// Setup phase: Pre-test validation executed once before all scenarios
export function setup() {
  console.log(
    "Setup: Verifying QuickPizza availability before running scenarios..."
  );
  const res = http.get(BASE_URL);
  if (res.status !== 200) {
    throw new Error(
      `Setup failed: Got unexpected status code ${res.status} when trying to setup. Exiting.`
    );
  }
  console.log("Setup: QuickPizza is available. Ready to run smoke scenarios.");
}

// Teardown phase: Post-test cleanup executed once after all scenarios
export function teardown() {
  console.log("Teardown: Cleaning up after smoke/stress scenarios...");
}

/*
DASHBOARD ANALYSIS (con este script):

📊 Overview:
 - http_req_duration (p95): objetivo < 500ms
 - http_req_failed: objetivo < 1%
 - Virtual Users: patrón claro 0→5→0 en el escenario stress

📊 Timings:
 - http_req_waiting (TTFB): objetivo < 200ms
 - http_req_connecting / blocked: bajos; vigilar pool de conexiones

📊 Summary:
 - checks: ≥ 95%
 - http_reqs: volumen esperado según stages
 - iteration_duration: ~1s por el sleep(1)

THRESHOLDS:
 ✅ Bueno: p95 < 500ms, 0% errores, patrón estable
 ⚠️  Atención: p95 500ms–1s, <0.1% errores, pequeñas variaciones
 ❌ Crítico: p95 > 1s, >1% errores, drops de tasa de solicitud
*/
