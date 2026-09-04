// goatbot v3.2 - 1.817 average score
// deployed 9/4/26

const C = "C"
const D = "D"

const WINDOW = 11
const COOPERATION_THRESHOLD = 0.61
const EXPLOIT_THRESHOLD = 0.4
const MIN_DEFECT_RESPONSE_SAMPLES = 3
const OLIVE_BRANCH_SCHEDULE = [5, 16, 40]
const TEST_STREAKS = [9, 24]
const TEST_COOLDOWN = 12
const MAX_FAILED_TESTS = 1
const HARD_DEFECT_RATE = 0.68
const HARD_NOISY_DEFECT_RATE = 0.35
const PANIC_AVG = 0.95
const DD_ESCAPE = 3

function freshMemory() {
    return {
        seen: 0,
        opponentC: 0,
        opponentD: 0,
        mutualDStreak: 0,
        olivesUsed: 0,
        sparsePeace: false,
        scoreTotal: 0,
        testRounds: [],
        testFailures: 0,
        testCooldown: 0,
        hardMode: false,
        flipNoise: 0,
        exploitRun: 0,
        lastProbeRound: -999,
    }
}

function safeMemory(memory) {
    if (!memory || typeof memory !== "object") return freshMemory()
    if (!Number.isFinite(memory.seen)) memory.seen = 0
    if (!Number.isFinite(memory.opponentC)) memory.opponentC = 0
    if (!Number.isFinite(memory.opponentD)) memory.opponentD = 0
    if (!Number.isFinite(memory.mutualDStreak)) memory.mutualDStreak = 0
    if (!Number.isFinite(memory.olivesUsed)) memory.olivesUsed = 0
    if (typeof memory.sparsePeace !== "boolean") memory.sparsePeace = false
    if (!Number.isFinite(memory.scoreTotal)) memory.scoreTotal = 0
    if (!Array.isArray(memory.testRounds)) memory.testRounds = []
    if (!Number.isFinite(memory.testFailures)) memory.testFailures = 0
    if (!Number.isFinite(memory.testCooldown)) memory.testCooldown = 0
    if (typeof memory.hardMode !== "boolean") memory.hardMode = false
    if (!Number.isFinite(memory.flipNoise)) memory.flipNoise = 0
    if (!Number.isFinite(memory.exploitRun)) memory.exploitRun = 0
    if (!Number.isFinite(memory.lastProbeRound)) memory.lastProbeRound = -999
    return memory
}

function payoff(you, opp) {
    if (you === C && opp === C) return 2
    if (you === D && opp === C) return 3
    if (you === C && opp === D) return 0
    return 1
}

function rebuildMemory(history, previous) {
    const m = safeMemory(previous)
    m.seen = 0
    m.opponentC = 0
    m.opponentD = 0
    m.mutualDStreak = 0
    m.scoreTotal = 0
    m.flipNoise = 0
    m.exploitRun = 0

    for (let i = 0; i < history.length; i++) {
        const r = history[i]
        const y = r.you === D ? D : C
        const o = r.opponent === D ? D : C

        if (o === D) m.opponentD++
        else m.opponentC++

        if (y === D && o === D) m.mutualDStreak++
        else m.mutualDStreak = 0

        m.scoreTotal += payoff(y, o)

        if (i >= 2) {
            const prevOpp = history[i - 1].opponent === D ? 1 : 0
            const nowOpp = o === D ? 1 : 0
            if (prevOpp !== nowOpp) m.flipNoise = Math.min(m.flipNoise + 1, 100)
            else m.flipNoise = Math.max(m.flipNoise - 1, 0)
        }
    }

    let failures = 0
    for (let i = 0; i < m.testRounds.length; i++) {
        const r = m.testRounds[i]
        if (Number.isFinite(r) && r + 1 < history.length && history[r + 1].opponent === D) failures++
    }
    m.testFailures = failures
    m.seen = history.length
    return m
}

function updateMemory(history, memory) {
    const n = history.length
    memory = safeMemory(memory)

    if (memory.seen !== n - 1) return rebuildMemory(history, memory)

    const last = history[n - 1]
    const y = last.you === D ? D : C
    const o = last.opponent === D ? D : C

    if (o === D) memory.opponentD++
    else memory.opponentC++

    if (y === D && o === D) memory.mutualDStreak++
    else memory.mutualDStreak = 0

    memory.scoreTotal += payoff(y, o)

    if (n >= 2) {
        const prevOpp = history[n - 2].opponent === D ? 1 : 0
        const nowOpp = o === D ? 1 : 0
        if (prevOpp !== nowOpp) memory.flipNoise = Math.min(memory.flipNoise + 1, 100)
        else memory.flipNoise = Math.max(memory.flipNoise - 1, 0)
    }

    if (memory.testCooldown > 0) memory.testCooldown--
    memory.seen = n
    return memory
}

function responseRates(history) {
    let coopAfterC = 0
    let sampleAfterC = 0
    let coopAfterD = 0
    let sampleAfterD = 0
    const start = Math.max(1, history.length - WINDOW)

    for (let i = start; i < history.length; i++) {
        const myPrev = history[i - 1].you === D ? D : C
        const oppNow = history[i].opponent === D ? D : C
        if (myPrev === C) {
            sampleAfterC++
            if (oppNow === C) coopAfterC++
        } else {
            sampleAfterD++
            if (oppNow === C) coopAfterD++
        }
    }

    return {
        pC: (coopAfterC + 0.5) / (sampleAfterC + 1),
        pD: (coopAfterD + 0.5) / (sampleAfterD + 1),
        samplesAfterD: sampleAfterD,
    }
}

function isUnconditionalPeriodic(history) {
    const n = history.length
    if (n < 12) return false
    const start = Math.max(0, n - 20)

    let sawC = false
    let sawD = false
    for (let i = start; i < n; i++) {
        if (history[i].opponent === C) sawC = true
        else sawD = true
    }
    if (!sawC || !sawD) return false

    for (let p = 2; p <= 6; p++) {
        let ok = true
        let checks = 0
        for (let i = start + p; i < n; i++) {
            checks++
            if (history[i].opponent !== history[i - p].opponent) {
                ok = false
                break
            }
        }
        if (!ok || checks < 8) continue

        let tftLike = true
        for (let i = Math.max(1, start); i < n; i++) {
            if (history[i].opponent !== history[i - 1].you) {
                tftLike = false
                break
            }
        }
        if (!tftLike) return true
    }

    return false
}

function sparsePrefix(history) {
    const n = history.length
    if (n === 3) {
        return (
            history[0].opponent === C &&
            history[1].opponent === C &&
            history[2].opponent === D &&
            history.every(r => r.you === C)
        )
    }
    if (n === 5) {
        return (
            history[0].opponent === C &&
            history[1].opponent === C &&
            history[2].opponent === C &&
            history[3].opponent === C &&
            history[4].opponent === D &&
            history.every(r => r.you === C)
        )
    }
    return false
}

function currentCoopStreak(history) {
    let s = 0
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].you === C && history[i].opponent === C) s++
        else break
    }
    return s
}

function decide(history, memory) {
    const n = history.length
    if (n === 0) return [C, freshMemory()]

    memory = updateMemory(history, memory)

    const last = history[n - 1]
    const prev = n >= 2 ? history[n - 2] : null
    const oppLast = last.opponent === D ? D : C

    if (history[0].opponent === D && history.every(r => r.you === C)) {
        if (n <= 4 || oppLast === C) return [C, memory]
    }

    if (!memory.sparsePeace && sparsePrefix(history)) {
        memory.sparsePeace = true
        return [C, memory]
    }

    if (memory.sparsePeace) {
        if (oppLast === D && prev && prev.opponent === D) memory.sparsePeace = false
        else return [C, memory]
    }

    if (memory.opponentD === 0) return [C, memory]

    if (isUnconditionalPeriodic(history)) return [D, memory]

    const {
        pC,
        pD,
        samplesAfterD
    } = responseRates(history)
    const total = memory.opponentC + memory.opponentD
    const defRate = total ? memory.opponentD / total : 0
    const avg = memory.scoreTotal / n
    const noisy = n >= 18 && memory.flipNoise >= 10 && defRate > 0.2 && defRate < 0.8

    if (
        memory.hardMode ||
        (memory.opponentD >= 4 && defRate > HARD_DEFECT_RATE) ||
        (n >= 18 && avg < PANIC_AVG) ||
        (noisy && defRate > HARD_NOISY_DEFECT_RATE) ||
        (memory.testFailures > MAX_FAILED_TESTS)
    ) {
        memory.hardMode = true
        memory.exploitRun = 0
        if (memory.opponentC > memory.opponentD && defRate < 0.48) {
            memory.hardMode = false
        } else {
            if (
                memory.opponentC > 0 &&
                memory.olivesUsed < OLIVE_BRANCH_SCHEDULE.length &&
                memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olivesUsed]
            ) {
                memory.olivesUsed++
                return [C, memory]
            }
            return [D, memory]
        }
    }

    if (samplesAfterD >= MIN_DEFECT_RESPONSE_SAMPLES && pD >= EXPLOIT_THRESHOLD && defRate < 0.42) {
        if (oppLast === C) {
            memory.exploitRun++
            if (memory.exploitRun % 7 === 0) return [C, memory]
            return [D, memory]
        }
        memory.exploitRun = 0
        return [D, memory]
    } else {
        memory.exploitRun = 0
    }

    if (pC >= COOPERATION_THRESHOLD) {
        const unprovokedD = oppLast === D && !(prev && prev.you === D)
        if (unprovokedD) return [D, memory]

        const cs = currentCoopStreak(history)
        if (
            oppLast === C &&
            memory.testFailures <= MAX_FAILED_TESTS &&
            memory.testRounds.length < TEST_STREAKS.length &&
            cs >= TEST_STREAKS[memory.testRounds.length] &&
            memory.testCooldown === 0 &&
            pD < 0.5 &&
            n - memory.lastProbeRound >= 10
        ) {
            memory.testRounds.push(n)
            memory.lastProbeRound = n
            memory.testCooldown = TEST_COOLDOWN
            return [D, memory]
        }

        if (memory.lastProbeRound === n - 1 && oppLast === D) memory.testFailures++

        if (memory.mutualDStreak >= DD_ESCAPE) return [C, memory]
        return [C, memory]
    }

    if (
        memory.opponentC > 0 &&
        memory.olivesUsed < OLIVE_BRANCH_SCHEDULE.length &&
        memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olivesUsed]
    ) {
        memory.olivesUsed++
        return [C, memory]
    }

    return [D, memory]
}

export default function bot(state) {
    let memory = state && state.memory && typeof state.memory === "object" ? state.memory : null
    try {
        const history = state && Array.isArray(state.history) ? state.history : []
        const [move, nextMemory] = decide(history, memory)
        return [move === C ? C : D, nextMemory]
    } catch {
        return [D, memory || freshMemory()]
    }
}