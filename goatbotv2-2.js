// goatbot v2.2 - 1.637 average score
// deployed 9/4/26

const WINDOW = 12
const COOPERATION_THRESHOLD = 0.6
const EXPLOIT_THRESHOLD = 0.37
const MIN_DEFECT_RESPONSE_SAMPLES = 3
const OLIVE_BRANCH_SCHEDULE = [4, 12, 30]
const TEST_SCHEDULE = [6, 18, 45]
const MAX_FAILED_TESTS = 2

function freshMemory() {
    return {
        seen: 0,
        opponentC: 0,
        opponentD: 0,
        mutualDStreak: 0,
        olives: 0,
        sparsePeace: false,
        score: 0,
        tests: [],
        hardLock: false,
        probeCooldown: 0,
        chaos: 0
    }
}

function rebuildMemory(history, previous) {
    const memory = freshMemory()

    if (previous && typeof previous === "object") {
        if (Number.isFinite(previous.olives)) memory.olives = Math.max(0, Math.floor(previous.olives))
        if (Array.isArray(previous.tests)) memory.tests = previous.tests.filter(Number.isFinite)
        if (typeof previous.sparsePeace === "boolean") memory.sparsePeace = previous.sparsePeace
        if (typeof previous.hardLock === "boolean") memory.hardLock = previous.hardLock
        if (Number.isFinite(previous.probeCooldown)) memory.probeCooldown = Math.max(0, Math.floor(previous.probeCooldown))
        if (Number.isFinite(previous.chaos)) memory.chaos = Math.max(0, Math.floor(previous.chaos))
    }

    for (let i = 0; i < history.length; i++) {
        const round = history[i]
        const you = round.you === "D" ? "D" : "C"
        const opp = round.opponent === "D" ? "D" : "C"

        if (opp === "D") memory.opponentD++
        else memory.opponentC++

        if (you === "D" && opp === "D") memory.mutualDStreak++
        else memory.mutualDStreak = 0

        memory.score +=
            you === "C" && opp === "C" ? 2 :
            you === "D" && opp === "C" ? 3 :
            you === "C" && opp === "D" ? 0 : 1

        if (i >= 2) {
            const prevOpp = history[i - 1].opponent === "D" ? 1 : 0
            const currOpp = opp === "D" ? 1 : 0
            if (prevOpp !== currOpp) memory.chaos = Math.min(memory.chaos + 1, 100)
            else memory.chaos = Math.max(memory.chaos - 1, 0)
        }
    }

    memory.seen = history.length
    return memory
}

function updateMemory(history, memory) {
    const n = history.length

    if (
        !memory ||
        typeof memory !== "object" ||
        memory.seen !== n - 1 ||
        !Number.isFinite(memory.opponentC) ||
        !Number.isFinite(memory.opponentD) ||
        !Number.isFinite(memory.mutualDStreak) ||
        !Number.isFinite(memory.olives) ||
        !Number.isFinite(memory.score) ||
        !Array.isArray(memory.tests) ||
        typeof memory.sparsePeace !== "boolean" ||
        typeof memory.hardLock !== "boolean" ||
        !Number.isFinite(memory.probeCooldown) ||
        !Number.isFinite(memory.chaos)
    ) {
        return rebuildMemory(history, memory)
    }

    const last = history[n - 1]
    const you = last.you === "D" ? "D" : "C"
    const opp = last.opponent === "D" ? "D" : "C"

    if (opp === "D") memory.opponentD++
    else memory.opponentC++

    if (you === "D" && opp === "D") memory.mutualDStreak++
    else memory.mutualDStreak = 0

    memory.score +=
        you === "C" && opp === "C" ? 2 :
        you === "D" && opp === "C" ? 3 :
        you === "C" && opp === "D" ? 0 : 1

    if (n >= 2) {
        const prevOpp = history[n - 2].opponent === "D" ? 1 : 0
        const currOpp = opp === "D" ? 1 : 0
        if (prevOpp !== currOpp) memory.chaos = Math.min(memory.chaos + 1, 100)
        else memory.chaos = Math.max(memory.chaos - 1, 0)
    }

    if (memory.probeCooldown > 0) memory.probeCooldown--

    memory.seen = n
    return memory
}

function responseRates(history) {
    let cooperateAfterC = 0
    let samplesAfterC = 0
    let cooperateAfterD = 0
    let samplesAfterD = 0
    const start = Math.max(1, history.length - WINDOW)

    for (let i = start; i < history.length; i++) {
        const ourPreviousMove = history[i - 1].you === "D" ? "D" : "C"
        const theirMove = history[i].opponent === "D" ? "D" : "C"

        if (ourPreviousMove === "C") {
            samplesAfterC++
            if (theirMove === "C") cooperateAfterC++
        } else {
            samplesAfterD++
            if (theirMove === "C") cooperateAfterD++
        }
    }

    return {
        pC: (cooperateAfterC + 0.5) / (samplesAfterC + 1),
        pD: (cooperateAfterD + 0.5) / (samplesAfterD + 1),
        samplesAfterD
    }
}

function isUnconditionalPeriodic(history) {
    const n = history.length
    if (n < 12) return false
    const start = Math.max(0, n - 22)
    let sawC = false
    let sawD = false

    for (let i = start; i < n; i++) {
        if (history[i].opponent === "C") sawC = true
        else sawD = true
    }
    if (!sawC || !sawD) return false

    for (let period = 2; period <= 6; period++) {
        let matches = true
        let comparisons = 0

        for (let i = start + period; i < n; i++) {
            comparisons++
            if (history[i].opponent !== history[i - period].opponent) {
                matches = false
                break
            }
        }

        if (!matches || comparisons < 8) continue

        let explainedByTitForTat = true
        for (let i = Math.max(1, start); i < n; i++) {
            if (history[i].opponent !== history[i - 1].you) {
                explainedByTitForTat = false
                break
            }
        }

        if (!explainedByTitForTat) return true
    }

    return false
}

function failedTests(history, tests) {
    let failed = 0
    for (let i = 0; i < tests.length; i++) {
        const r = tests[i]
        if (r + 1 < history.length && history[r + 1].opponent === "D") failed++
    }
    return failed
}

function decide(history, memory) {
    const n = history.length
    if (n === 0) return ["C", freshMemory()]

    memory = updateMemory(history, memory)

    const last = history[n - 1]
    const previous = n >= 2 ? history[n - 2] : null
    const lastOpp = last.opponent === "D" ? "D" : "C"

    if (history[0].opponent === "D" && history.every(r => r.you === "C")) {
        if (n <= 5 || lastOpp === "C") return ["C", memory]
    }

    if (memory.sparsePeace) {
        if (
            lastOpp === "D" &&
            previous !== null &&
            (previous.opponent === "D")
        ) {
            memory.sparsePeace = false
        } else {
            return ["C", memory]
        }
    }

    const cop3 =
        n === 3 &&
        history[0].opponent === "C" &&
        history[1].opponent === "C" &&
        history[2].opponent === "D"

    const cop5 =
        n === 5 &&
        history[0].opponent === "C" &&
        history[1].opponent === "C" &&
        history[2].opponent === "C" &&
        history[3].opponent === "C" &&
        history[4].opponent === "D"

    if ((cop3 || cop5) && history.every(r => r.you === "C")) {
        memory.sparsePeace = true
        return ["C", memory]
    }

    if (memory.opponentD === 0) return ["C", memory]

    if (isUnconditionalPeriodic(history)) return ["D", memory]

    const {
        pC,
        pD,
        samplesAfterD
    } = responseRates(history)
    const total = memory.opponentC + memory.opponentD
    const defRate = total ? memory.opponentD / total : 0
    const avg = memory.score / n
    const noisy = n >= 18 && memory.chaos >= 10 && defRate > 0.2 && defRate < 0.8

    const testFails = failedTests(history, memory.tests)

    if (
        memory.hardLock ||
        memory.opponentD >= 4 && defRate > 0.72 ||
        (n >= 22 && avg < 0.9) ||
        (noisy && defRate > 0.45) ||
        testFails >= 3
    ) {
        memory.hardLock = true
        if (memory.opponentC > memory.opponentD && defRate < 0.53) {
            memory.hardLock = false
        } else {
            if (
                memory.opponentC > 0 &&
                memory.olives < OLIVE_BRANCH_SCHEDULE.length &&
                memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olives]
            ) {
                memory.olives++
                return ["C", memory]
            }
            return ["D", memory]
        }
    }

    if (
        samplesAfterD >= MIN_DEFECT_RESPONSE_SAMPLES &&
        pD >= EXPLOIT_THRESHOLD &&
        defRate < 0.38
    ) {
        return ["D", memory]
    }

    if (pC >= COOPERATION_THRESHOLD) {
        const theirDWasProvoked =
            lastOpp === "D" &&
            previous !== null &&
            previous.you === "D"

        if (lastOpp === "D" && !theirDWasProvoked) return ["D", memory]

        let coopStreak = 0
        for (let i = n - 1; i >= 0; i--) {
            if (history[i].you === "C" && history[i].opponent === "C") coopStreak++
            else break
        }

        if (
            lastOpp === "C" &&
            memory.tests.length < TEST_SCHEDULE.length &&
            testFails < MAX_FAILED_TESTS &&
            coopStreak >= TEST_SCHEDULE[memory.tests.length] &&
            memory.probeCooldown === 0
        ) {
            memory.tests.push(n)
            memory.probeCooldown = 10
            return ["D", memory]
        }

        if (
            memory.mutualDStreak >= 4 &&
            memory.opponentC > 0
        ) {
            return ["C", memory]
        }

        return ["C", memory]
    }

    if (
        memory.opponentC > 0 &&
        memory.olives < OLIVE_BRANCH_SCHEDULE.length &&
        memory.mutualDStreak >= OLIVE_BRANCH_SCHEDULE[memory.olives]
    ) {
        memory.olives++
        return ["C", memory]
    }

    return ["D", memory]
}

export default function bot(state) {
    let memory =
        state && state.memory && typeof state.memory === "object" ?
        state.memory :
        null

    try {
        const history = state && Array.isArray(state.history) ? state.history : []
        const [move, nextMemory] = decide(history, memory)
        return [move === "C" ? "C" : "D", nextMemory]
    } catch {
        return ["D", memory || freshMemory()]
    }
}