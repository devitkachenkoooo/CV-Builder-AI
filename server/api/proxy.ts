import { Router } from "express";

const router = Router();

// Proxy endpoint for html2pdf.js
router.get("/html2pdf.js", async (req, res) => {
  try {
    console.log("Proxy request received for html2pdf.js");
    const url = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    
    // Use Node.js https module instead of fetch
    const https = require('https');
    const http = require('http');
    
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (response: any) => {
      console.log(`Response status: ${response.statusCode}`);
      console.log(`Content-Type: ${response.headers['content-type']}`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Failed to fetch script: ${response.statusCode}`);
      }
      
      // Set appropriate headers
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      // Pipe the response
      response.pipe(res);
    }).on('error', (err: any) => {
      console.error("Proxy error:", err);
      res.status(500).send("// Failed to load html2pdf.js");
    });
    
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("// Failed to load html2pdf.js");
  }
});

export default router;
