/**
 * Nexus Ora MVP - Pipeline Verification Test
 * Tests the full pipeline without starting the HTTP server
 * Run: node verify.js
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ==================== Configuration ====================

const PYTHON_PATH = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
const ENGINE_PATH = path.join(__dirname, 'paipan_engine.py');

let passCount = 0;
let failCount = 0;

function check(name, condition, detail) {
    if (condition) {
        console.log(`  [PASS] ${name}`);
        passCount++;
    } else {
        console.log(`  [FAIL] ${name} - ${detail}`);
        failCount++;
    }
}

// ==================== Python Paipan Test ====================

async function testPaipan() {
    console.log('\n=== Test 1: Python Paipan Engine ===');
    
    return new Promise((resolve, reject) => {
        const python = spawn(PYTHON_PATH, [ENGINE_PATH]);
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => { stdout += data.toString(); });
        python.stderr.on('data', (data) => { stderr += data.toString(); });
        
        python.on('close', (code) => {
            check('Python process exit code 0', code === 0, `exit code: ${code}, stderr: ${stderr}`);
            
            try {
                const result = JSON.parse(stdout.trim());
                check('Result has success=true', result.success === true, JSON.stringify(result).substring(0, 100));
                check('Has bazi data', !!result.bazi, 'bazi field missing');
                check('Has year pillar', !!result.bazi.year, 'year pillar missing');
                check('Has day pillar', !!result.bazi.day, 'day pillar missing');
                check('Has wuxing balance', !!result.wuxing_balance, 'wuxing_balance missing');
                check('Has pillars array', Array.isArray(result.pillars), 'pillars not array');
                check('Has 4 pillars', result.pillars?.length === 4, `found ${result.pillars?.length}`);
                check('Has animal info', !!result.info?.animal, 'animal missing');
                check('Has zodiac info', !!result.info?.zodiac, 'zodiac missing');
                
                console.log('\n  Bazi result:');
                console.log(`    Year:  ${result.bazi.year}  Day: ${result.bazi.day}`);
                console.log(`    Month: ${result.bazi.month}  Hour: ${result.bazi.hour}`);
                console.log(`    Body:  ${result.bazi.body_strength} (score: ${result.bazi.strength_score})`);
                console.log(`    Day master: ${result.bazi.day_gan} (${result.bazi.day_wuxing})`);
                console.log(`    Animal/Zodiac: ${result.info.animal} / ${result.info.zodiac}`);
                
                resolve(result);
            } catch (e) {
                check('Valid JSON output', false, `parse error: ${e.message}, raw: ${stdout.substring(0, 200)}`);
                reject(e);
            }
        });
        
        python.on('error', (err) => {
            check('Python process started', false, err.message);
            reject(err);
        });
        
        const input = JSON.stringify({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: '女' });
        python.stdin.write(input);
        python.stdin.end();
    });
}

// ==================== Fortune Generation Test ====================

function generateFortuneData(paipanResult) {
    const strengthScore = paipanResult.bazi?.strength_score || 50;
    const dayWuxing = paipanResult.bazi?.day_wuxing || '金';
    const dayIndex = { '金': 0, '水': 1, '木': 2, '火': 3, '土': 4 }[dayWuxing] || 0;
    
    const phases = [
        { start: 0, end: 18, name: '成长期', base: 48 },
        { start: 19, end: 30, name: '上升期', base: 58 },
        { start: 31, end: 45, name: '黄金期', base: 68 },
        { start: 46, end: 60, name: '稳固期', base: 56 },
        { start: 61, end: 75, name: '智慧期', base: 62 },
        { start: 76, end: 100, name: '颐养期', base: 50 }
    ];
    
    const fortuneData = [];
    
    for (let age = 0; age <= 100; age++) {
        const phase = phases.find(p => age >= p.start && age <= p.end) || phases[0];
        const cyclePosition = (age + dayIndex * 2) % 10;
        
        let wuxingBonus = 0;
        if (dayWuxing === '金') {
            if (cyclePosition <= 1) wuxingBonus = 12;
            else if (cyclePosition <= 3) wuxingBonus = 3;
            else if (cyclePosition <= 5) wuxingBonus = -8;
            else if (cyclePosition <= 7) wuxingBonus = 6;
            else wuxingBonus = 10;
        } else if (dayWuxing === '木') {
            if (cyclePosition <= 1) wuxingBonus = -5;
            else if (cyclePosition <= 3) wuxingBonus = 10;
            else if (cyclePosition <= 5) wuxingBonus = 5;
            else if (cyclePosition <= 7) wuxingBonus = -3;
            else wuxingBonus = 8;
        } else if (dayWuxing === '水') {
            if (cyclePosition <= 1) wuxingBonus = 8;
            else if (cyclePosition <= 3) wuxingBonus = -3;
            else if (cyclePosition <= 5) wuxingBonus = 10;
            else if (cyclePosition <= 7) wuxingBonus = -5;
            else wuxingBonus = 6;
        } else if (dayWuxing === '火') {
            if (cyclePosition <= 1) wuxingBonus = 10;
            else if (cyclePosition <= 3) wuxingBonus = 5;
            else if (cyclePosition <= 5) wuxingBonus = -3;
            else if (cyclePosition <= 7) wuxingBonus = 8;
            else wuxingBonus = -8;
        } else {
            if (cyclePosition <= 1) wuxingBonus = 5;
            else if (cyclePosition <= 3) wuxingBonus = -5;
            else if (cyclePosition <= 5) wuxingBonus = 8;
            else if (cyclePosition <= 7) wuxingBonus = -3;
            else wuxingBonus = 10;
        }
        
        const random = Math.sin(age * 0.7) * 10 + Math.cos(age * 0.3) * 5;
        let score = Math.round(phase.base + wuxingBonus + random + (strengthScore - 50) * 0.15);
        score = Math.max(10, Math.min(98, score));
        
        let level;
        if (score >= 75) level = '大吉';
        else if (score >= 60) level = '小吉';
        else if (score >= 45) level = '平稳';
        else if (score >= 30) level = '小凶';
        else level = '大凶';
        
        fortuneData.push({ age, score, level, phase: phase.name });
    }
    
    return fortuneData;
}

async function testFortuneGeneration(paipanResult) {
    console.log('\n=== Test 2: Fortune Data Generation ===');
    
    const fortuneData = generateFortuneData(paipanResult);
    
    check('101 data points (0-100)', fortuneData.length === 101, `got ${fortuneData.length}`);
    check('All have score field', fortuneData.every(f => typeof f.score === 'number'), 'missing score');
    check('All have level field', fortuneData.every(f => typeof f.level === 'string'), 'missing level');
    check('All have age field', fortuneData.every(f => typeof f.age === 'number'), 'missing age');
    check('All have phase field', fortuneData.every(f => typeof f.phase === 'string'), 'missing phase');
    
    const scores = fortuneData.map(f => f.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const maxAge = fortuneData.find(f => f.score === max)?.age;
    const minAge = fortuneData.find(f => f.score === min)?.age;
    const peakYears = fortuneData.filter(f => f.score >= 75).map(f => f.age);
    const valleyYears = fortuneData.filter(f => f.score < 35).map(f => f.age);
    
    check('Scores in range 10-98', min >= 10 && max <= 98, `min=${min}, max=${max}`);
    check('Has valid average', avg >= 30 && avg <= 75, `avg=${avg}`);
    
    console.log('\n  Fortune stats:');
    console.log(`    Average: ${avg}/100`);
    console.log(`    Peak:    ${max} at age ${maxAge}`);
    console.log(`    Valley:  ${min} at age ${minAge}`);
    console.log(`    Peak years: ${peakYears.length} (${peakYears.slice(0, 5).join(', ')}...)`);
    console.log(`    Low years:  ${valleyYears.length} (${valleyYears.slice(0, 3).join(', ')}...)`);
    
    // Phase distribution
    const phaseCount = {};
    fortuneData.forEach(f => { phaseCount[f.phase] = (phaseCount[f.phase] || 0) + 1; });
    console.log('    Phase distribution:', JSON.stringify(phaseCount));
    
    return fortuneData;
}

// ==================== Summary Test ====================

function testSummary(paipanResult, fortuneData) {
    console.log('\n=== Test 3: Report Summary ===');
    
    const summary = {
        body_strength: paipanResult.bazi?.body_strength || '--',
        day_master: paipanResult.bazi?.day_gan || '--',
        day_wuxing: paipanResult.bazi?.day_wuxing || '--',
        animal: paipanResult.info?.animal || '--',
        best_ages: fortuneData.filter(f => f.score >= 75).map(f => f.age).slice(0, 5),
        challenging_ages: fortuneData.filter(f => f.score < 35).map(f => f.age).slice(0, 3),
        average_score: Math.round(fortuneData.reduce((s, f) => s + f.score, 0) / fortuneData.length)
    };
    
    check('Has body_strength', !!summary.body_strength, 'missing');
    check('Has day_master', !!summary.day_master, 'missing');
    check('Has day_wuxing', !!summary.day_wuxing, 'missing');
    check('Has animal', !!summary.animal, 'missing');
    check('Has best_ages', Array.isArray(summary.best_ages) && summary.best_ages.length > 0, 'empty');
    check('Has average_score', typeof summary.average_score === 'number', 'not a number');
    
    return summary;
}

// ==================== Report Structure Test ====================

function testReportStructure(paipanResult, fortuneData, summary) {
    console.log('\n=== Test 4: Report Structure ===');
    
    const report = {
        bazi: paipanResult,
        fortune: fortuneData,
        ai_analysis: null,
        ai_enhanced: false,
        summary
    };
    
    check('Has bazi', !!report.bazi, 'missing');
    check('Has fortune array', Array.isArray(report.fortune) && report.fortune.length === 101, 'wrong length');
    check('Has summary', !!report.summary, 'missing');
    check('JSON serializable', (() => { try { JSON.stringify(report); return true; } catch(e) { return false; } })(), 'serialization failed');
    
    // Test JSON round-trip
    const serialized = JSON.stringify(report);
    check('Serialized < 1MB', serialized.length < 1024 * 1024, `${serialized.length} bytes`);
    
    const deserialized = JSON.parse(serialized);
    check('Deserialize matches', deserialized.bazi.bazi.year === report.bazi.bazi.year, 'mismatch');
    
    return report;
}

// ==================== Multiple Test Cases ====================

async function testMultipleBirthdays() {
    console.log('\n=== Test 5: Multiple Birthdays ===');
    
    const testCases = [
        { year: 1990, month: 6, day: 15, hour: 14, minute: 30, gender: '女', desc: '1990-06-15 女' },
        { year: 1985, month: 1, day: 1, hour: 6, minute: 0, gender: '男', desc: '1985-01-01 男' },
        { year: 2000, month: 12, day: 31, hour: 23, minute: 59, gender: '女', desc: '2000-12-31 女' },
        { year: 1975, month: 3, day: 20, hour: 8, minute: 15, gender: '男', desc: '1975-03-20 男' },
        { year: 2020, month: 7, day: 7, hour: 12, minute: 0, gender: '男', desc: '2020-07-07 男' }
    ];
    
    for (const tc of testCases) {
        const result = await new Promise((resolve) => {
            const python = spawn(PYTHON_PATH, [ENGINE_PATH]);
            let stdout = '';
            python.stdout.on('data', (d) => { stdout += d.toString(); });
            python.on('close', () => {
                try { resolve(JSON.parse(stdout.trim())); }
                catch (e) { resolve({ success: false, error: 'parse error' }); }
            });
            python.on('error', () => resolve({ success: false, error: 'spawn error' }));
            python.stdin.write(JSON.stringify(tc));
            python.stdin.end();
        });
        
        const passes = result.success
            && result.bazi?.year
            && result.bazi?.day
            && result.info?.animal
            && result.pillars?.length === 4;
        
        check(tc.desc, passes,
            passes ? '' : `failed: ${result.error || 'incomplete data'}`);
        
        if (passes) {
            console.log(`    Bazi: ${result.bazi.year} ${result.bazi.month} ${result.bazi.day} ${result.bazi.hour} | ${result.info.animal}`);
        }
    }
}

// ==================== Main ====================

(async () => {
    console.log('========================================');
    console.log('  Nexus Ora MVP - Verification Suite');
    console.log('========================================');
    console.log(`  Python: ${PYTHON_PATH}`);
    console.log(`  Engine: ${ENGINE_PATH}`);
    console.log(`  Time:   ${new Date().toISOString()}`);
    console.log('========================================');
    
    try {
        const paipanResult = await testPaipan();
        const fortuneData = await testFortuneGeneration(paipanResult);
        const summary = testSummary(paipanResult, fortuneData);
        const report = testReportStructure(paipanResult, fortuneData, summary);
        await testMultipleBirthdays();
        
        // Save sample report
        const samplePath = path.join(__dirname, 'sample_report.json');
        fs.writeFileSync(samplePath, JSON.stringify(report, null, 2));
        
        console.log('\n========================================');
        console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
        console.log(`  Sample report saved: ${samplePath}`);
        console.log('========================================');
        
        if (failCount > 0) {
            process.exit(1);
        }
    } catch (err) {
        console.error('\n[FATAL]', err.message);
        process.exit(1);
    }
})();
