# Shared Notes Web Frontend

Frontend web per l'applicazione Shared Notes. Un'interfaccia utente reattiva per la gestione e condivisione di note tra utenti.

## Caratteristiche Principali

- **Single Page Application (SPA)**: Navigazione fluida senza ricaricamenti di pagina
- **Design Responsive**: Ottimizzato per desktop, tablet e mobile
- **Autenticazione JWT**: Sistema di login/logout sicuro
- **Gestione Note**: Creazione, modifica, eliminazione e visualizzazione note
- **Sistema Tag**: Organizzazione e filtri per etichette
- **Condivisione**: Condivisione di note tra utenti
- **Ricerca**: Ricerca full-text nelle note
- **UI Moderna**: Interfaccia pulita con Bootstrap 5

## Stack Tecnologico

- **HTML5**: Struttura semantica
- **CSS3**: Stili moderni e responsive
- **JavaScript ES6+**: Logica applicativa
- **Bootstrap 5.3**: Framework UI
- **Bootstrap Icons**: Icone vettoriali
- **Fetch API**: Comunicazione con backend REST

## Installazione e Setup

### Prerequisiti

- Backend Shared Notes API in esecuzione

### Setup Locale

1. **Clona il repository**:
```bash
git clone git@github.com:rabbagliettiandrea/shared-notes-web.git
cd shared-notes-web
```

2. **Configura l'API URL (opzionale)**:

Modifica `config.js` per puntare al tuo backend:
```javascript
API_BASE_URL: 'http://localhost:8000/api/v1'
```

3. **Apri il file `index.html` con un browser**:

Visita `http://localhost:8080` nel browser

## Deploy su produzione

Per il deploy in produzione è sufficiente fare push sul branch `main` per attivare automaticamente la procedura di rilascio. 

Avverrà il trigger di una GitHub Actions che si occupa di buildare l'applicazione e deployarla su AWS CloudFront per la distribuzione globale del contenuto statico.

## Configurazione

### File di Configurazione

Il file `config.js` contiene tutte le configurazioni dell'applicazione.

### Configurazione per Ambienti

#### Sviluppo Locale
```javascript
API_BASE_URL: 'http://localhost:8000/api/v1'
```

#### Produzione - CloudFront (AWS)
```javascript
API_BASE_URL: 'https://d2w8ulo83u5tax.cloudfront.net/api/v1'
```