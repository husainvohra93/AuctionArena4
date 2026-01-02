const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const Team = require('../models/Team');
const Player = require('../models/Player');

router.get('/teams-template', async (req, res) => {
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

router.get('/players-template', async (req, res) => {
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

module.exports = router;
