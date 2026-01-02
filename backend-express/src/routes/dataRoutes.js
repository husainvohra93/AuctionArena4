const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const Auction = require('../models/Auction'); // Need Auction model
const { requireAdmin, requireAuth } = require('../middleware/auth'); // Need requireAuth

const upload = multer({ storage: multer.memoryStorage() });

// ... (previous imports and templates)

// Helper to create teams template
router.get('/export/teams-template', async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Teams');
    sheet.columns = [
        { header: 'name', key: 'name', width: 30 },
        { header: 'short_name', key: 'short_name', width: 10 },
        { header: 'budget', key: 'budget', width: 15 },
        { header: 'owner_email', key: 'owner_email', width: 25 },
        { header: 'logo_url', key: 'logo_url', width: 30 }
    ];
    sheet.addRow({ name: 'Mumbai Warriors', short_name: 'MW', budget: 10000000, owner_email: 'owner1@example.com', logo_url: '' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=teams_template.xlsx');
    await workbook.xlsx.write(res);
    res.end();
});

// Helper to create players template
router.get('/export/players-template', async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Players');
    sheet.columns = [
        { header: 'name', key: 'name', width: 30 },
        { header: 'role', key: 'role', width: 15 },
        { header: 'base_price', key: 'base_price', width: 15 },
        { header: 'age', key: 'age', width: 10 },
        { header: 'batting_style', key: 'batting_style', width: 20 },
        { header: 'bowling_style', key: 'bowling_style', width: 20 },
        { header: 'matches', key: 'matches', width: 10 },
        { header: 'runs', key: 'runs', width: 10 },
        { header: 'wickets', key: 'wickets', width: 10 },
        { header: 'image_url', key: 'image_url', width: 30 }
    ];
    sheet.addRow({ name: 'Virat Sharma', role: 'batsman', base_price: 500000, age: 28, batting_style: 'right-handed', matches: 50, runs: 2000, wickets: 0 });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=players_template.xlsx');
    await workbook.xlsx.write(res);
    res.end();
});

// Import Teams
router.post('/import/teams/:tournamentId', requireAdmin, upload.single('file'), async (req, res) => {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findOne({ tournament_id: tournamentId });
    if (!tournament) return res.status(404).json({ detail: 'Tournament not found' });

    if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1); // First sheet

        const promises = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const name = row.getCell(1).text;
            if (!name) return;

            const short_name = row.getCell(2).text || name.substring(0, 3).toUpperCase();
            const budget = row.getCell(3).value || 10000000;
            const owner_email = row.getCell(4).text;
            const logo_url = row.getCell(5).text;

            const teamId = `team_${uuidv4().substring(0, 8)}`;
            promises.push(Team.create({
                team_id: teamId,
                name: name,
                short_name: short_name,
                budget: Number(budget),
                remaining_budget: Number(budget),
                owner_email: owner_email || null,
                logo_url: logo_url || null,
                tournament_id: tournamentId,
                players: []
            }));
        });

        await Promise.all(promises);
        res.json({ message: `Successfully imported ${promises.length} teams` });

    } catch (e) {
        console.error(e);
        res.status(400).json({ detail: `Error processing file: ${e.message}` });
    }
});

// Import Players
router.post('/import/players/:tournamentId', requireAdmin, upload.single('file'), async (req, res) => {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findOne({ tournament_id: tournamentId });
    if (!tournament) return res.status(404).json({ detail: 'Tournament not found' });

    if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);

        const promises = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const name = row.getCell(1).text;
            if (!name) return;

            const role = row.getCell(2).text || 'batsman';
            const base_price = row.getCell(3).value || 100000;
            const age = row.getCell(4).value;
            const batting_style = row.getCell(5).text;
            const bowling_style = row.getCell(6).text;
            const matches = row.getCell(7).value || 0;
            const runs = row.getCell(8).value || 0;
            const wickets = row.getCell(9).value || 0;
            const image_url = row.getCell(10).text;

            const playerId = `player_${uuidv4().substring(0, 8)}`;
            promises.push(Player.create({
                player_id: playerId,
                name,
                role: role.toLowerCase(),
                base_price: Number(base_price),
                current_price: 0,
                status: 'unsold',
                age: Number(age) || null,
                batting_style: batting_style || null,
                bowling_style: bowling_style || null,
                matches: Number(matches),
                runs: Number(runs),
                wickets: Number(wickets),
                image_url: image_url || null,
                tournament_id: tournamentId
            }));
        });

        await Promise.all(promises);
        res.json({ message: `Successfully imported ${promises.length} players` });

    } catch (e) {
        console.error(e);
        res.status(400).json({ detail: `Error processing file: ${e.message}` });
    }
});

// Export Teams Data
router.get('/export/teams/:tournamentId', async (req, res) => {
    const { tournamentId } = req.params;
    const teams = await Team.find({ tournament_id: tournamentId });
    if (!teams.length) return res.status(404).json({ detail: 'No teams found' });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Teams');
    sheet.columns = [
        { header: 'Team Name', key: 'name', width: 30 },
        { header: 'Short Name', key: 'short_name', width: 10 },
        { header: 'Total Budget', key: 'budget', width: 15 },
        { header: 'Remaining Budget', key: 'remaining_budget', width: 15 },
        { header: 'Spent', key: 'spent', width: 15 },
        { header: 'Players Count', key: 'players_count', width: 15 },
        { header: 'Owner Email', key: 'owner_email', width: 25 }
    ];

    teams.forEach(team => {
        sheet.addRow({
            name: team.name,
            short_name: team.short_name,
            budget: team.budget,
            remaining_budget: team.remaining_budget,
            spent: team.budget - team.remaining_budget,
            players_count: team.players.length,
            owner_email: team.owner_email
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=teams_${tournamentId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// Export Players Data
router.get('/export/players/:tournamentId', async (req, res) => {
    const { tournamentId } = req.params;
    const players = await Player.find({ tournament_id: tournamentId });
    const teams = await Team.find({ tournament_id: tournamentId });
    const teamMap = teams.reduce((acc, t) => { acc[t.team_id] = t.name; return acc; }, {});

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Players');
    sheet.columns = [
        { header: 'Player Name', key: 'name', width: 30 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Base Price', key: 'base_price', width: 15 },
        { header: 'Sold Price', key: 'sold_price', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Sold To', key: 'sold_to', width: 30 },
        { header: 'Age', key: 'age', width: 10 },
        { header: 'Matches', key: 'matches', width: 10 },
        { header: 'Runs', key: 'runs', width: 10 },
        { header: 'Wickets', key: 'wickets', width: 10 }
    ];

    players.forEach(player => {
        sheet.addRow({
            name: player.name,
            role: player.role,
            base_price: player.base_price,
            sold_price: player.sold_price || 'Unsold',
            status: player.status,
            sold_to: teamMap[player.sold_to] || 'Unsold',
            age: player.age,
            matches: player.matches,
            runs: player.runs,
            wickets: player.wickets
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=players_${tournamentId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// Export Auction Results
router.get('/export/auction-results/:tournamentId', async (req, res) => {
    const { tournamentId } = req.params;
    const teams = await Team.find({ tournament_id: tournamentId });
    const players = await Player.find({ tournament_id: tournamentId });

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
        { header: 'Team', key: 'team', width: 30 },
        { header: 'Short Name', key: 'short_name', width: 10 },
        { header: 'Total Budget', key: 'budget', width: 15 },
        { header: 'Spent', key: 'spent', width: 15 },
        { header: 'Remaining', key: 'remaining', width: 15 },
        { header: 'Players Bought', key: 'players_bought', width: 15 }
    ];

    teams.forEach(team => {
        const teamPlayers = players.filter(p => p.sold_to === team.team_id);
        const totalSpent = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
        summarySheet.addRow({
            team: team.name,
            short_name: team.short_name,
            budget: team.budget,
            spent: totalSpent,
            remaining: team.remaining_budget,
            players_bought: teamPlayers.length
        });

        // Team Sheets
        const sheetName = (team.short_name || team.name).substring(0, 30); // 31 limit
        const teamSheet = workbook.addWorksheet(sheetName);
        teamSheet.columns = [
            { header: 'Player', key: 'player', width: 30 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Base Price', key: 'base_price', width: 15 }
        ];
        teamPlayers.forEach(p => {
            teamSheet.addRow({
                player: p.name,
                role: p.role,
                price: p.sold_price,
                base_price: p.base_price
            });
        });
    });

    // Unsold Sheet
    const unsoldPlayers = players.filter(p => p.status === 'unsold');
    if (unsoldPlayers.length) {
        const unsoldSheet = workbook.addWorksheet('Unsold');
        unsoldSheet.columns = [
            { header: 'Player', key: 'player', width: 30 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Base Price', key: 'base_price', width: 15 }
        ];
        unsoldPlayers.forEach(p => {
            unsoldSheet.addRow({
                player: p.name,
                role: p.role,
                base_price: p.base_price
            });
        });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=auction_results_${tournamentId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// NEW: Team Owner Export
router.get('/team-owner/export/excel', requireAuth, async (req, res) => {
    // Check if user has team
    if (!req.user.team_id) {
        return res.status(400).json({ detail: 'No team assigned to your account' });
    }
    const teamId = req.user.team_id;

    const team = await Team.findOne({ team_id: teamId });
    if (!team) return res.status(404).json({ detail: 'Team not found' });

    const tournament = team.tournament_id ? await Tournament.findOne({ tournament_id: team.tournament_id }) : null;
    const players = await Player.find({ sold_to: teamId });
    const auctions = team.tournament_id ? await Auction.find({ tournament_id: team.tournament_id }) : [];

    const workbook = new ExcelJS.Workbook();

    // Team Summary
    const summarySheet = workbook.addWorksheet('Team Summary');
    summarySheet.columns = [
        { header: 'Team Name', key: 'name', width: 30 },
        { header: 'Short Name', key: 'short_name', width: 10 },
        { header: 'Tournament', key: 'tournament', width: 25 },
        { header: 'Total Budget', key: 'budget', width: 15 },
        { header: 'Remaining Budget', key: 'remaining', width: 15 },
        { header: 'Amount Spent', key: 'spent', width: 15 },
        { header: 'Players Acquired', key: 'players', width: 15 },
        { header: 'Owner Email', key: 'email', width: 25 },
        { header: 'Export Date', key: 'date', width: 20 }
    ];
    summarySheet.addRow({
        name: team.name,
        short_name: team.short_name,
        tournament: tournament ? tournament.name : 'N/A',
        budget: team.budget,
        remaining: team.remaining_budget,
        spent: team.budget - team.remaining_budget,
        players: players.length,
        email: team.owner_email || '',
        date: new Date().toISOString()
    });

    // Squad
    if (players.length > 0) {
        const squadSheet = workbook.addWorksheet('Squad');
        squadSheet.columns = [
            { header: 'Player Name', key: 'name', width: 30 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Base Price', key: 'base', width: 15 },
            { header: 'Purchased Price', key: 'price', width: 15 },
            { header: 'Age', key: 'age', width: 10 },
            { header: 'Batting Style', key: 'batting', width: 20 },
            { header: 'Bowling Style', key: 'bowling', width: 20 },
            { header: 'Matches', key: 'matches', width: 10 },
            { header: 'Runs', key: 'runs', width: 10 },
            { header: 'Wickets', key: 'wickets', width: 10 }
        ];
        players.forEach(p => {
            squadSheet.addRow({
                name: p.name,
                role: p.role,
                base: p.base_price,
                price: p.sold_price,
                age: p.age,
                batting: p.batting_style,
                bowling: p.bowling_style,
                matches: p.matches,
                runs: p.runs,
                wickets: p.wickets
            });
        });
    }

    // Auctions
    if (auctions.length > 0) {
        const auctionSheet = workbook.addWorksheet('Auctions');
        auctionSheet.columns = [
            { header: 'Auction Name', key: 'name', width: 25 },
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Players Per Team', key: 'limit', width: 15 }
        ];
        auctions.forEach(a => {
            auctionSheet.addRow({
                name: a.name,
                date: a.date || 'N/A',
                status: a.status,
                limit: a.players_per_team
            });
        });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${team.short_name || 'team'}_data.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// NEW: Team Owner PDF Export
router.get('/team-owner/export/pdf', requireAuth, async (req, res) => {
    // Check if user has team
    if (!req.user.team_id) {
        return res.status(400).json({ detail: 'No team assigned to your account' });
    }
    const teamId = req.user.team_id;

    // Fetch data
    const team = await Team.findOne({ team_id: teamId });
    if (!team) return res.status(404).json({ detail: 'Team not found' });

    const tournament = team.tournament_id ? await Tournament.findOne({ tournament_id: team.tournament_id }) : null;
    const players = await Player.find({ sold_to: teamId });

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${team.short_name || 'team'}_squad.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(24).fillColor('#1e3a5f').text(`${team.name} - Squad Report`, { align: 'center' });
    doc.moveDown(0.5);

    // Draw line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#3b82f6').lineWidth(2).stroke();
    doc.moveDown(1.5);

    // Summary Box
    const startY = doc.y;
    doc.fillColor('#f8fafc').rect(50, startY, 500, 80).fill();

    doc.fillColor('#6b7280').fontSize(10);
    // Grid layout simulation for summary
    // Row 1
    doc.text('Tournament', 70, startY + 15);
    doc.text('Players Acquired', 300, startY + 15);

    doc.fillColor('#1e3a5f').fontSize(14).font('Helvetica-Bold');
    doc.text(tournament ? tournament.name : 'N/A', 70, startY + 30);
    doc.text(players.length.toString(), 300, startY + 30);

    // Row 2
    doc.fillColor('#6b7280').fontSize(10).font('Helvetica');
    doc.text('Total Budget', 70, startY + 50);
    doc.text('Remaining Budget', 300, startY + 50);

    doc.fillColor('#1e3a5f').fontSize(14).font('Helvetica-Bold');
    doc.text(`${(team.budget || 0).toLocaleString()} Pts`, 70, startY + 65);
    doc.text(`${(team.remaining_budget || 0).toLocaleString()} Pts`, 300, startY + 65);

    doc.moveDown(4);

    // Squad Table Header
    const tableTop = doc.y + 40;
    doc.fontSize(16).fillColor('#1e3a5f').text(`Squad (${players.length} Players)`, 50, doc.y);
    doc.moveDown(1);

    // Table Headers
    const headers = ['#', 'Player Name', 'Role', 'Price (Pts)', 'Matches'];
    const colWidths = [30, 180, 100, 100, 60];
    let currentX = 50;
    const headerY = doc.y + 10;

    // Header Background
    doc.fillColor('#1e3a5f').rect(50, headerY - 5, 500, 25).fill();

    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, i) => {
        doc.text(header, currentX + 5, headerY + 2);
        currentX += colWidths[i];
    });

    // Rows
    let rowY = headerY + 25;
    doc.font('Helvetica').fontSize(10).fillColor('black');

    players.forEach((player, i) => {
        // Alternating row color
        if (i % 2 === 0) {
            doc.fillColor('#f3f4f6').rect(50, rowY - 5, 500, 20).fill();
        }
        doc.fillColor('black');

        currentX = 50;
        const rowData = [
            (i + 1).toString(),
            player.name,
            player.role ? player.role.charAt(0).toUpperCase() + player.role.slice(1) : '-',
            (player.sold_price || 0).toLocaleString(),
            (player.matches || 0).toString()
        ];

        rowData.forEach((text, colIndex) => {
            doc.text(text, currentX + 5, rowY + 2);
            currentX += colWidths[colIndex];
        });

        rowY += 20;

        // New page if needed
        if (rowY > 700) {
            doc.addPage();
            rowY = 50;
        }
    });

    // Footer
    const bottomY = doc.page.height - 50;
    doc.fontSize(10).fillColor('#9ca3af').text(
        `Generated on ${new Date().toUTCString()} | AuctionArena`,
        50,
        bottomY,
        { align: 'center', width: 500 }
    );

    doc.end();
});

module.exports = router;
