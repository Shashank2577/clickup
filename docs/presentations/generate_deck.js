const PptxGenJS = require('pptxgenjs');

async function createPitchDeck() {
    let pres = new PptxGenJS();
    pres.layout = 'LAYOUT_16x9';
    pres.author = 'Engineering Team';
    pres.title = 'ClickUp OSS Pitch Deck';

    // Define Masters
    pres.defineSlideMaster({
        title: 'TITLE_SLIDE',
        background: { color: '1E2761' }, // Navy
        objects: [
            { rect: { x: 0, y: 4.5, w: '100%', h: 1.125, fill: { color: 'CADCFC' } } } // Ice blue bottom accent
        ]
    });

    pres.defineSlideMaster({
        title: 'CONTENT_SLIDE',
        background: { color: 'FFFFFF' },
        objects: [
            { rect: { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: '1E2761' } } } // Navy top bar
        ]
    });

    // 1. Title Slide
    let slide1 = pres.addSlide({ masterName: 'TITLE_SLIDE' });
    slide1.addText('ClickUp OSS', {
        x: 0.5, y: 2.0, w: 9, h: 1, 
        fontSize: 54, fontFace: 'Arial Black', color: 'FFFFFF', bold: true, align: 'center'
    });
    slide1.addText('Project Management Reimagined', {
        x: 0.5, y: 3.2, w: 9, h: 0.5, 
        fontSize: 24, fontFace: 'Arial', color: 'CADCFC', align: 'center', italic: true
    });
    slide1.addText('Open Source. Self-Hosted. AI-Native.', {
        x: 0.5, y: 4.8, w: 9, h: 0.5, 
        fontSize: 18, fontFace: 'Arial', color: '1E2761', align: 'center', bold: true
    });

    // 2. Problem Statement
    let slide2 = pres.addSlide({ masterName: 'CONTENT_SLIDE' });
    slide2.addText('The Problem', { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 32, fontFace: 'Arial Black', color: 'FFFFFF' });
    slide2.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 4, h: 3.5, fill: { color: 'F2F2F2' } });
    slide2.addText([
        { text: "Fragmented Workflows", options: { bullet: true, breakLine: true, bold: true } },
        { text: "Teams use 5+ tools for docs, tasks, and chats.", options: { breakLine: true, color: "666666" } },
        { text: "Vendor Lock-in", options: { bullet: true, breakLine: true, bold: true } },
        { text: "Proprietary systems hold your data hostage.", options: { breakLine: true, color: "666666" } },
        { text: "High Costs", options: { bullet: true, breakLine: true, bold: true } },
        { text: "Enterprise tiers cost $30+/user/month.", options: { color: "666666" } }
    ], { x: 0.8, y: 1.8, w: 3.4, h: 3, fontSize: 16, fontFace: 'Arial', color: '1E2761', valign: 'top' });

    // Add a big stat
    slide2.addText("80%", { x: 5.5, y: 1.8, w: 3, h: 1.5, fontSize: 80, fontFace: 'Arial Black', color: '1E2761', align: 'center' });
    slide2.addText("of teams struggle with tool fragmentation", { x: 5.5, y: 3.3, w: 3, h: 1, fontSize: 16, fontFace: 'Arial', color: '666666', align: 'center' });

    // 3. Our Solution
    let slide3 = pres.addSlide({ masterName: 'CONTENT_SLIDE' });
    slide3.addText('The Solution: ClickUp OSS', { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 32, fontFace: 'Arial Black', color: 'FFFFFF' });
    
    // Create a 3-column layout
    let colWidth = 2.8;
    let startY = 1.5;
    
    // Box 1
    slide3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: startY, w: colWidth, h: 3, fill: { color: '1E2761' } });
    slide3.addText("All-in-One", { x: 0.5, y: startY + 0.5, w: colWidth, h: 0.5, fontSize: 20, fontFace: 'Arial Black', color: 'FFFFFF', align: 'center' });
    slide3.addText("Tasks, Docs, Goals, and Whiteboards combined.", { x: 0.8, y: startY + 1.2, w: colWidth - 0.6, h: 1.5, fontSize: 14, fontFace: 'Arial', color: 'CADCFC', align: 'center', valign: 'top' });

    // Box 2
    slide3.addShape(pres.shapes.RECTANGLE, { x: 0.5 + colWidth + 0.3, y: startY, w: colWidth, h: 3, fill: { color: 'CADCFC' } });
    slide3.addText("Self-Hosted", { x: 0.5 + colWidth + 0.3, y: startY + 0.5, w: colWidth, h: 0.5, fontSize: 20, fontFace: 'Arial Black', color: '1E2761', align: 'center' });
    slide3.addText("100% data ownership. Deploy on your infrastructure.", { x: 0.5 + colWidth + 0.3 + 0.3, y: startY + 1.2, w: colWidth - 0.6, h: 1.5, fontSize: 14, fontFace: 'Arial', color: '1E2761', align: 'center', valign: 'top' });

    // Box 3
    slide3.addShape(pres.shapes.RECTANGLE, { x: 0.5 + (colWidth + 0.3) * 2, y: startY, w: colWidth, h: 3, fill: { color: '1E2761' } });
    slide3.addText("AI-Native", { x: 0.5 + (colWidth + 0.3) * 2, y: startY + 0.5, w: colWidth, h: 0.5, fontSize: 20, fontFace: 'Arial Black', color: 'FFFFFF', align: 'center' });
    slide3.addText("Built-in summarization, writing assistance, and automated planning.", { x: 0.5 + (colWidth + 0.3) * 2 + 0.3, y: startY + 1.2, w: colWidth - 0.6, h: 1.5, fontSize: 14, fontFace: 'Arial', color: 'CADCFC', align: 'center', valign: 'top' });

    // 4. Architecture
    let slide4 = pres.addSlide({ masterName: 'CONTENT_SLIDE' });
    slide4.addText('Microservices Architecture', { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 32, fontFace: 'Arial Black', color: 'FFFFFF' });
    
    let tableData = [
        [
            { text: "Component", options: { fill: { color: "1E2761" }, color: "FFFFFF", bold: true, fontSize: 16 } },
            { text: "Technology", options: { fill: { color: "1E2761" }, color: "FFFFFF", bold: true, fontSize: 16 } },
            { text: "Purpose", options: { fill: { color: "1E2761" }, color: "FFFFFF", bold: true, fontSize: 16 } }
        ],
        ["API Gateway", "Express.js, WS", "Routing, Rate Limiting, Real-time"],
        ["Core Services", "Node.js, TypeScript", "Task, Docs, Identity, Goals"],
        ["Message Bus", "NATS JetStream", "Eventual Consistency, WebSockets"],
        ["Databases", "PostgreSQL, Redis", "Relational persistence, Caching"],
        ["Search", "Elasticsearch", "Fast full-text search"]
    ];
    
    slide4.addTable(tableData, { 
        x: 0.5, y: 1.5, w: 9, 
        border: { pt: 1, color: "CADCFC" },
        fill: { color: "F2F2F2" },
        fontSize: 14, fontFace: 'Arial', color: '1E2761',
        rowH: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6]
    });

    // 5. AI Capabilities
    let slide5 = pres.addSlide({ masterName: 'CONTENT_SLIDE' });
    slide5.addText('AI at the Core', { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 32, fontFace: 'Arial Black', color: 'FFFFFF' });
    
    slide5.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 4, h: 3, fill: { color: 'CADCFC' } });
    slide5.addText("Powered by Anthropic & OpenAI", { x: 0.5, y: 2.5, w: 4, h: 1, fontSize: 22, fontFace: 'Arial Black', color: '1E2761', align: 'center' });

    slide5.addText([
        { text: "Task Breakdown:", options: { bullet: true, breakLine: true, bold: true } },
        { text: "Generate subtasks instantly.", options: { breakLine: true, color: "666666" } },
        { text: "Writing Assistant:", options: { bullet: true, breakLine: true, bold: true } },
        { text: "Polish, expand, or fix grammar.", options: { breakLine: true, color: "666666" } },
        { text: "Doc Generation:", options: { bullet: true, breakLine: true, bold: true } },
        { text: "Auto-generate PRDs and meeting notes.", options: { color: "666666" } }
    ], { x: 5, y: 1.5, w: 4.5, h: 3, fontSize: 16, fontFace: 'Arial', color: '1E2761' });

    // 6. Conclusion
    let slide6 = pres.addSlide({ masterName: 'TITLE_SLIDE' });
    slide6.addText('Ready to Build?', {
        x: 0.5, y: 2.0, w: 9, h: 1, 
        fontSize: 48, fontFace: 'Arial Black', color: 'FFFFFF', bold: true, align: 'center'
    });
    slide6.addText('Clone. Deploy. Conquer.', {
        x: 0.5, y: 3.2, w: 9, h: 0.5, 
        fontSize: 24, fontFace: 'Arial', color: 'CADCFC', align: 'center', italic: true
    });

    await pres.writeFile({ fileName: "docs/presentations/Pitch_Deck.pptx" });
    console.log('Pitch deck created successfully.');
}

createPitchDeck().catch(console.error);
