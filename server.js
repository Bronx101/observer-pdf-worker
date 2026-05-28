```javascript
require('dotenv').config();

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true
  });
});

app.post('/render', async (req, res) => {
  let browser;

  try {
    const auth = req.headers.authorization;

    const expectedAuth =
      'Bearer ' + process.env.WORKER_SECRET;

    if (auth !== expectedAuth) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const { units } = req.body;

    if (!units || !units.length) {
      return res.status(400).json({
        error: 'Missing units'
      });
    }

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 1400,
      height: 2000,
      deviceScaleFactor: 2
    });

    const reportUrl =
      'https://rh-prp.com/ObserverReportView' +
      '?units=' + units.join(',') +
      '&print=1' +
      '&renderAll=1';

    console.log('Opening:', reportUrl);

    await page.goto(reportUrl, {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    await page.waitForFunction(() => {
      return (
        document.documentElement.getAttribute('data-ready') === 'true'
      );
    }, {
      timeout: 120000
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '8mm',
        right: '8mm',
        bottom: '8mm',
        left: '8mm'
      }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'inline; filename=observer-report.pdf'
    });

    res.send(pdf);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `PDF Worker running on port ${PORT}`
  );
});
```
