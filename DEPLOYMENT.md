# 🚀 Deployment Guide - Shared Notes Web

Questa guida ti aiuterà a deployare l'applicazione Shared Notes Web su AWS S3 usando GitHub Actions.

## 📋 Prerequisiti

- [ ] Account AWS attivo
- [ ] AWS CLI installato e configurato
- [ ] Repository GitHub con il codice
- [ ] Backend API già deployato e accessibile

## 🔧 Setup AWS

### 1. Configura AWS CLI

```bash
# Installa AWS CLI se non già presente
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# Configura le credenziali
aws configure
# Inserisci:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (es. us-east-1)
# - Default output format (json)
```

### 2. Crea il Bucket S3

```bash
# Rendi eseguibile lo script
chmod +x setup-aws.sh

# Esegui lo script di setup (sostituisci con il nome del tuo bucket)
./setup-aws.sh shared-notes-web-prod us-east-1

# Oppure crea manualmente:
aws s3 mb s3://shared-notes-web-prod --region us-east-1
aws s3 website s3://shared-notes-web-prod --index-document index.html --error-document index.html
```

### 3. Configura CloudFront (Opzionale ma Raccomandato)

```bash
# Crea una distribuzione CloudFront per migliori performance
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## 🔐 Configura GitHub Secrets

Vai su: `https://github.com/TUO_USERNAME/TUO_REPO/settings/secrets/actions`

Aggiungi questi secrets:

### Obbligatori
- `AWS_ACCESS_KEY_ID`: La tua AWS Access Key
- `AWS_SECRET_ACCESS_KEY`: La tua AWS Secret Key  
- `AWS_REGION`: La regione AWS (es. `us-east-1`)
- `S3_BUCKET_NAME`: Nome del bucket S3 (es. `shared-notes-web-prod`)

### Opzionali (per CloudFront)
- `CLOUDFRONT_DISTRIBUTION_ID`: ID della distribuzione CloudFront
- `CLOUDFRONT_DOMAIN`: Dominio CloudFront (es. `d1234567890.cloudfront.net`)

## 🚀 Deploy

### Deploy Automatico

Il deploy avviene automaticamente quando:
- Push su branch `main` o `master`
- Pull request su `main` o `master`

### Deploy Manuale

```bash
# Push del codice
git add .
git commit -m "Deploy to production"
git push origin main
```

## 📁 Struttura File Deployati

Il workflow deploya questi file:
- ✅ `index.html`
- ✅ `app.js`
- ✅ `config.js`
- ✅ `styles.css`
- ✅ Altri file statici necessari

Esclude:
- ❌ `.git/`
- ❌ `.github/`
- ❌ `node_modules/`
- ❌ `*.md`
- ❌ File di configurazione

## 🔧 Configurazione API

Assicurati di aggiornare `config.js` con l'URL corretto del backend:

```javascript
const CONFIG = {
    // Cambia questo con il tuo endpoint API
    API_BASE_URL: 'https://your-api-domain.com/api/v1',
    // ... resto della configurazione
};
```

## 🌐 URL del Sito

Dopo il deploy, il sito sarà disponibile su:

**S3 Website Endpoint:**
```
http://shared-notes-web-prod.s3-website-us-east-1.amazonaws.com
```

**CloudFront (se configurato):**
```
https://d1234567890.cloudfront.net
```

## 🔍 Troubleshooting

### Errore: "Access Denied"
- Verifica che il bucket policy permetta l'accesso pubblico
- Controlla che le credenziali AWS siano corrette

### Errore: "Bucket not found"
- Assicurati che il bucket S3 esista
- Verifica che il nome del bucket sia corretto nei secrets

### Errore: "Invalid credentials"
- Controlla i GitHub Secrets
- Verifica che le credenziali AWS abbiano i permessi necessari

### Permessi IAM Necessari

L'utente AWS deve avere questi permessi:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::shared-notes-web-prod",
                "arn:aws:s3:::shared-notes-web-prod/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation"
            ],
            "Resource": "*"
        }
    ]
}
```

## 📊 Monitoraggio

### GitHub Actions
- Vai su: `https://github.com/TUO_USERNAME/TUO_REPO/actions`
- Monitora i log del workflow per errori

### AWS CloudWatch
- Monitora i log di accesso del bucket S3
- Controlla le metriche CloudFront se utilizzato

## 🔄 Aggiornamenti

Per aggiornare l'applicazione:
1. Modifica il codice localmente
2. Testa le modifiche
3. Push su GitHub
4. Il deploy avviene automaticamente

## 🆘 Supporto

Se hai problemi:
1. Controlla i log di GitHub Actions
2. Verifica la configurazione AWS
3. Controlla i GitHub Secrets
4. Consulta la documentazione AWS S3

---

**Nota**: Ricorda di aggiornare `config.js` con l'URL corretto del tuo backend API prima del deploy!
