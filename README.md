# 🛒 DATA-MARKET — Análisis de Canasta de Mercado con ECLAT

##  Prompt de IA utilizado

Este proyecto fue desarrollado con apoyo de Claude (Anthropic) como asistente de análisis, redacción técnica y generación de código. El prompt base que guió el trabajo fue el siguiente:

``` 
Tengo un proyecto de Market Basket Analysis con datos de hogares colombianos recolectados en Google Forms. Los datos se limpian automáticamente con Apps Script (one-hot encoding y normalización de ciudades)
y se organizan en arquitectura Medallion: Bronze (crudo), Silver (limpio en Sheets) y Gold (análisis en Colab). El notebook se conecta directamente a la capa Silver con gspread y OAuth2, entonces no te preocupes por la carga de csv ni nada.

Realiza el análisis usando ECLAT (pyECLAT), con soporte ≥ 30%, confianza ≥ 60% y máximo tripletes (k=3).

Genera reglas de asociación incluyendo soporte, confianza, lift (>1), conviction, leverage y Zhang.

En el EDA incluye variables como estrato, edad, tamaño del hogar, frecuencia de compra, género y presupuesto. Para variables binarias usa correlación phi y similitud Jaccard en co-ocurrencias.

Segmenta por estrato y grupo etario, usando soporte adaptativo: max(0.20, 3/n).

Visualiza con:

Grafo en NetworkX (nodo = centralidad, arco = confianza y lift)
Gráficos interactivos en Plotly (scatter soporte vs confianza, tamaño = lift)
Dashboard ejecutivo final
```

> La IA ayudó con la implementación y redacción, pero las decisiones de diseño del pipeline, la elección de ECLAT sobre Apriori, el diseño del formulario, el ETL en Apps Script y la interpretación de los hallazgos en contexto colombiano fueron propias de Rebeca.

---


> Patrones de compra en hogares colombianos detectados con minería de datos.  
> **201 hogares · 45 productos · 6.609 reglas de asociación · 2026**

---

## ¿Qué es esto?

DATA-MARKET es un proyecto de análisis de canasta de mercado (Market Basket Analysis) aplicado a datos primarios de hogares colombianos. Usamos el algoritmo **ECLAT** para encontrar qué productos se compran juntos, con qué frecuencia, y cómo esos patrones cambian según el estrato socioeconómico, la edad y el canal de compra.

El pipeline es completamente automático: cuando alguien responde la encuesta, un Trigger de Google Apps Script limpia y transforma los datos en tiempo real. El cuaderno de Colab se conecta directamente a Google Sheets sin necesidad de cargar ningún CSV manualmente.

---

##  Estructura del repositorio

```
DATA-MARKET/
│
├── limpieza.js          # ETL en Google Apps Script (Trigger automático)
├── DATA_MARKET.ipynb    # Notebook de análisis en Google Colab
└── README.md
```

---

##  Arquitectura del pipeline

```
Google Forms  ──►  Apps Script (Trigger)  ──►  Google Sheets
   Bronze                  ETL                     Silver
                                                      │
                                               gspread API (OAuth2)
                                                      │
                                             Google Colab (ECLAT)
                                                    Gold
```

| Capa | Herramienta | Descripción |
|------|-------------|-------------|
| **Bronze** | Google Forms | Respuestas crudas de la encuesta |
| **Silver** | Google Sheets + Apps Script | Datos limpios, one-hot encoded, normalizados |
| **Gold** | Google Colab | Itemsets frecuentes, reglas de asociación, visualizaciones |

---

##  Recursos del proyecto

| Recurso | Enlace |
|---------|--------|
|  Notebook Google Colab | [Abrir en Colab](https://colab.research.google.com/drive/1pzvHIjT0Vsi9wZt86f7sYbfat6tDRYv9?usp=sharing) |
|  Google Sheets (Silver Layer) | [Ver datos](https://docs.google.com/spreadsheets/d/1I25vlgcHIgBXAaDZA_Hj0ntBMheT5STA7K0CCU0RLe0/edit) |
|  Formulario de encuesta | [Responder](https://forms.gle/ZBZiXiLH69ZDKPBU9) |
|  Código Apps Script | [`limpieza.js`](./limpieza.js) |

---

##  Cómo correr el análisis

### 1. Abrir el notebook en Colab

Haz clic en el enlace de arriba o ábrelo directamente desde Google Drive.

### 2. Autenticarse con Google

El notebook usa OAuth2 nativo de Colab. Al ejecutar la primera celda de conexión, aparece un popup de autenticación:

```python
from google.colab import auth
auth.authenticate_user()
```

### 3. Ejecutar todo

Una vez autenticado, ejecuta todas las celdas en orden (`Runtime > Run all`). El notebook se conecta automáticamente a la hoja `limpieza` del Google Sheets y no requiere cargar ningún archivo manualmente.

### 4. Instalar dependencias (primera vez)

La primera celda del notebook instala todo lo necesario:

```bash
!pip install pyECLAT gspread mlxtend openpyxl plotly
```

---

##  Dependencias principales

| Librería | Uso |
|----------|-----|
| `pyECLAT` | Algoritmo ECLAT con TID-lists |
| `mlxtend` | Generación de reglas y métricas |
| `gspread` | Conexión a Google Sheets |
| `pandas` / `numpy` | Manipulación de datos |
| `matplotlib` / `seaborn` | Visualizaciones estáticas |
| `plotly` | Visualizaciones interactivas |
| `networkx` | Grafo de reglas de asociación |
| `openpyxl` | Exportación a Excel |

---

##  Principales hallazgos

- **Canal dominante:** Hard Discount con 94.5% de penetración
- **Producto más comprado:** Carne (98.5% de los hogares)
- **Par más afín:** Huevos ↔ Aceite con Jaccard = **0.97**
- **Hub del modelo:** Pescado aparece en las 20 reglas más fuertes (lift promedio 2.04×)
- **Regla más fuerte:** Carne + Desodorante → Pescado (confianza 90.4%, lift 2.041)
- **Reglas generadas:** 6.609 con soporte ≥ 30% y confianza ≥ 60%
- **Hallazgo clave:** Los 8 productos más comprados son todos **Frescos** — no carbohidratos

---

##  Apps Script — Trigger automático

El archivo `limpieza.js` contiene la función `pipelineLimpiezaEclatFinal()`, que se ejecuta automáticamente cada vez que se envía una respuesta al formulario.

**Qué hace:**
- Normaliza nombres de ciudades (diccionario de reglas)
- Convierte respuestas de selección múltiple a one-hot encoding
- Estandariza variables categóricas (responsabilidad de compra)
- Construye cabeceras dinámicas con prefijos `Prod_` y `Canal_`
- Escribe los datos limpios en la hoja `limpieza` en tiempo real

**Configuración del Trigger:**
```
Tipo:     Desde la hoja de cálculo — Al enviar el formulario
Función:  pipelineLimpiezaEclatFinal
Estado:   Activo | Tasa de error: 0%
```

---

##  Parámetros del modelo

```python
MIN_SUPPORT     = 0.30   # Patrón debe aparecer en ≥30% de los hogares
MIN_CONFIDENCE  = 0.60   # Confianza mínima de la regla
MAX_COMBINATION = 3      # Itemsets de hasta 3 productos (tripletes)
```

En el análisis segmentado por estrato y edad, el soporte mínimo se ajusta adaptativamente:

```python
adaptive_min_sup = max(0.20, 3 / n_segmento)
```

---

##  Dataset

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `Genero` | Categórica | Masculino / Femenino |
| `Edad` | Categórica | Rango de edad del encuestado |
| `Ciudad_Normalizada` | Texto | Ciudad estandarizada por el ETL |
| `Estrato` | Numérica | NSE 1–6 |
| `Hogar_Size` | Categórica | Tamaño del hogar |
| `Presupuesto` | Categórica | Rango de presupuesto mensual (COP) |
| `Frecuencia` | Categórica | Frecuencia de compra |
| `Prod_X` | Binaria (0/1) | 45 columnas — uno por producto |
| `Canal_X` | Binaria (0/1) | 5 columnas — uno por canal |

---

##  Licencia

Proyecto académico — Universidad Libre, 2026.  
Rebeca Pedrozo Cueto
