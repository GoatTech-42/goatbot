// goatbot v3.1 - 1.7 average score
// deployed 9/4/26

const WINDOW = 11
const COOPERATION_THRESHOLD = 0.61
const EXPLOIT_THRESHOLD = 0.41
const MIN_DEFECT_RESPONSE_SAMPLES = 3
const OLIVE_BRANCH_SCHEDULE = [5, 17, 45]
const TEST_STREAKS = [9, 26]
const TEST_COOLDOWN = 12
const MAX_FAILED_TESTS = 1

function createMemory() {
    return {
        seen: 0,
        opponentC: 0,
        opponentD: 0,
        mutualDStreak: 0,
        olivesUsed: 0,
        cooperateBias: false,
        scoreTotal: 0,
        testRounds: [],
        testFailures: 0,
        testCooldown: 0,
        hardMode: false,
        flipNoise: 0,
    }
}

function sanitizeMemory(memory) {
    if (!memory || typeof memory !== "object") return createMemory()

    if (!Number.isFinite(memory.seen)) memory.seen = 0
    if (!Number.isFinite(memory.opponentC)) memory.opponentC = 0
    if (!Number.isFinite(memory.opponentD)) memory.opponentD = 0
    if (!Number.isFinite(memory.mutualDStreak)) memory.mutualDStreak = 0
    if (!Number.isFinite(memory.olivesUsed)) memory.olivesUsed = 0
    if (typeof memory.cooperateBias !== "boolean") memory.cooperateBias = false
    if (!Number.isFinite(memory.scoreTotal)) memory.scoreTotal = 0
    if (!Array.isArray(memory.testRounds)) memory.testRounds = []
    if (!Number.isFinite(memory.testFailures)) memory.testFailures = 0
    if (!Number.isFinite(memory.testCooldown)) memory.testCooldown = 0
    if (typeof memory.hardMode !== "boolean") memory.hardMode = false
    if (!Number.isFinite(memory.flipNoise)) memory.flipNoise = 0

    return memory
}

function rebuildFromHistory(history, previous) {
    const memory = sanitizeMemory(previous)

    memory.seen = 0
    memory.opponentC = 0
    memory.opponentD = 0
    memory.mutualDStreak = 0
    memory.scoreTotal = 0
    memory.flipNoise = 0

    for (let i = 0; i < history.length; i++) {
        const round = history[i]
        const ourMove = round.you === "D" ? "D" : "C"
        const oppMove = round.opponent === "D" ? "D" : "C"

        if (oppMove === "D") memory.opponentD++
        else memory.opponentC++

        if (ourMove === "D" && oppMove === "D") memory.mutualDStreak++
        else memory.mutualDStreak = 0

        memory.scoreTotal +=
            ourMove === "C" && oppMove === "C" ?
            2 :
            ourMove === "D" && oppMove === "C" ?
            3 :
            ourMove === "C" && oppMove === "D" ?
            0 :
            1

        if (i >= 2) {
            const prevOpp = history[i - 1].opponent === "D" ? 1 : 0
            const nowOpp = oppMove === "D" ? 1 : 0
            if (prevOpp !== nowOpp) memory.flipNoise = Math.min(memory.flipNoise + 1, 100)
            else memory.flipNoise = Math.max(memory.flipNoise - 1, 0)
        }
    }

    let failures = 0
    for (let i = 0; i < memory.testRounds.length; i++) {
        const r = memory.testRounds[i]
        if (Number.isFinite(r) && r + 1 < history.length && history[r + 1].opponent === "D") failures++
    }
    memory.testFailures = failures
    memory.seen = history.length
    return memory
}

function updateMemory(history, memory) {
    const n = history.length
    memory = sanitizeMemory(memory)

    if (memory.seen !== n - 1) return rebuildFromHistory(history, memory)

    const last = history[n - 1]
    const ourMove = last.you === "D" ? "D" : "C"
    const oppMove = last.opponent === "D" ? "D" : "C"

    if (oppMove === "D") memory.opponentD++
    else memory.opponentC++

    if (ourMove === "D" && oppMove === "D") memory.mutualDStreak++
    else memory.mutualDStreak = 0

    memory.scoreTotal +=
        ourMove === "C" && oppMove === "C" ?
        2 :
        ourMove === "D" && oppMove === "C" ?
        3 :
        ourMove === "C" && oppMove === "D" ?
        0 :
        1

    if (n >= 2) {
        const prevOpp = history[n - 2].opponent === "D" ? 1 : 0
        const nowOpp = oppMove === "D" ? 1 : 0
        if (prevOpp !== nowOpp) memory.flipNoise = Math.min(memory.flipNoise + 1, 100)
        else memory.flipNoise = Math.max(memory.flipNoise - 1, 0)
    }

    if (memory.testCooldown > 0) memory.testCooldown--
    memory.seen = n
    return memory
}

function conditionalRates(history) {
    let coopAfterC = 0
    let countAfterC = 0
    let coopAfterD = 0
    let countAfterD = 0
    const start = Math.max(1, history.length - WINDOW)

    for (let i = start; i < history.length; i++) {
        const prevUs = history[i - 1].you === "D" ? "D" : "C"
        const oppNow = history[i].opponent === "D" ? "D" : "C"

        if (prevUs === "C") {
            countAfterC++
            if (oppNow === "C") coopAfterC++
        } else {
            countAfterD++
            if (oppNow === "C") coopAfterD++
        }
    }

    return {
        pC: (coopAfterC + 0.5) / (countAfterC + 1),
        pD: (coopAfterD + 0.5) / (countAfterD + 1),
        samplesAfterD: countAfterD,
    }
}

function isMostlyPeriodic(history) {
    const n = history.length
    if (n < 12) return false
    const start = Math.max(0, n - 20)

    let sawC = false
    let sawD = false
    for (let i = start; i < n; i++) {
        if (history[i].opponent === "C") sawC = true
        else sawD = true
    }
    if (!sawC || !sawD) return false

    for (let period = 2; period <= 6; period++) {
        let ok = true
        let checks = 0
        for (let i = start + period; i < n; i++) {
            checks++
            if (history[i].opponent !== history[i - period].opponent) {
                ok = false
                break
            }
        }
        if (!ok || checks < 8) continue

        let pureTFT = true
        for (let i = Math.max(1, start); i < n; i++) {
            if (history[i].opponent !== history[i - 1].you) {
                pureTFT = false
                break
            }
        }
        if (!pureTFT) return true
    }

    return false
}

function sparseSignature(history) {
    const n = history.length
    if (n === 3) {
        return (
            history[0].opponent === "C" &&
            history[1].opponent === "C" &&
            history[2].opponent === "D" &&
            history.every(r => r.you === "C")
        )
    }
    if (n === 5) {
        return (
            history[0].opponent === "C" &&
            history[1].opponent === "C" &&
            history[2].opponent === "C" &&
            history[3].opponent === "C" &&
            history[4].opponent === "D" &&
            history.every(r => r.you === "C")
        )
    }
    return false
}

function shouldProbe(memory, coopStreak, pC, pD, defRate) {
    if (memory.testFailures > MAX_FAILED_TESTS) return false
    if (memory.testRounds.length >= TEST_STREAKS.length) return false
    if (memory.testCooldown > 0) return false
    if (pC < COOPERATION_THRESHOLD) return false
    if (defRate > 0.28) return false
    if (pD > EXPLOIT_THRESHOLD) return false
    return coopStreak >= TEST_STREAKS[memory.testRounds.length]
}

function decide(history, memory) {
    const n = history.length
    if (n === 0) return ["C", createMemory()]

    memory = updateMemory(history, memory)
    const last = history[n - 1]
    const previous = n >= 2 ? history[n - 2] : null
    const lastOpp = last.opponent === "D" ? "D" : "C"

    if (history[0].opponent === "D" && history.every(r => r.you === "C")) {
        if (n <= 4 || lastOpp === "C") return ["C", memory]
    }

    if (!memory.cooperateBias && sparseSignature(history)) {
        memory.cooperateBias = true
        return ["C", memory]
    }

    if (memory.cooperateBias) {
        if (lastOpp === "D" && previous && previous.opponent === "D") {
            memory.cooperateBias = false
        } else {
            return ["C", memory]
        }
    }

    if (memory.opponentD === 0) return ["C", memory]

    if (isMostlyPeriodic(history)) return ["D", memory]

    const {
        pC,
        pD,
        samplesAfterD
    } = conditionalRates(history)
    const total = memory.opponentC + memory.opponentD
    const defRate = total ? memory.opponentD / total : 0
    const avgScore = memory.scoreTotal / n
    const noisy = n >= 18 && memory.flipNoise >= 10 && defRate > 0.2 && defRate < 0.8

    if (
        memory.hardMode ||
        (memory.opponentD >= 4 && defRate > 0.68) ||
        (n >= 18 && avgScore < 0.95) ||
        (noisy && defRate > 0.35) ||
        (memory.testFailures > MAX_FAILED_TESTS)
    ) {
        memory.hardMode = true
        if (memory.opponentC > memory.opponentD && defRate < 0.48) {
            memory.hardMode = false
        } else {
            if (
                memory.opponentC > 0 &&
                memory.olivesUsed < OLIVE_BRANCH_SCHEDULE.length &&
                memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olivesUsed]
            ) {
                memory.olivesUsed++
                return ["C", memory]
            }
            return ["D", memory]
        }
    }

    if (samplesAfterD >= MIN_DEFECT_RESPONSE_SAMPLES && pD >= EXPLOIT_THRESHOLD && defRate < 0.35) {
        return ["D", memory]
    }

    if (pC >= COOPERATION_THRESHOLD) {
        const unprovokedD =
            lastOpp === "D" &&
            !(previous && previous.you === "D")

        if (unprovokedD) return ["D", memory]

        let coopStreak = 0
        for (let i = n - 1; i >= 0; i--) {
            if (history[i].you === "C" && history[i].opponent === "C") coopStreak++
            else break
        }

        if (lastOpp === "C" && shouldProbe(memory, coopStreak, pC, pD, defRate)) {
            memory.testRounds.push(n)
            memory.testCooldown = TEST_COOLDOWN
            return ["D", memory]
        }

        if (memory.mutualDStreak >= 3) return ["C", memory]
        return ["C", memory]
    }

    if (
        memory.opponentC > 0 &&
        memory.olivesUsed < OLIVE_BRANCH_SCHEDULE.length &&
        memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olivesUsed]
    ) {
        memory.olivesUsed++
        return ["C", memory]
    }

    return ["D", memory]
}

export default function bot(state) {
    let memory = state && state.memory && typeof state.memory === "object" ? state.memory : null

    try {
        const history = state && Array.isArray(state.history) ? state.history : []
        const [move, nextMemory] = decide(history, memory)
        return [move === "C" ? "C" : "D", nextMemory]
    } catch {
        return ["D", memory || createMemory()]
    }
}
