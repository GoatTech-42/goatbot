// goatbot v1 - 1.210 average score
// deployed 9/3/26

export default function bot({
    history,
    memory
}) {

    memory = memory ?? {
        round: 0,
        mode: "unknown",
        oppC: 0,
        oppD: 0,
        testDone: false,
        forgivenessCooldown: 0,
        recentOpp: [],
        recentYou: [],
        exploitStep: 0,
    };

    const round = history.length;

    if (round > 0) {
        const last = history[round - 1];
        if (last.opponent === "C") memory.oppC++;
        else memory.oppD++;

        memory.recentOpp.push(last.opponent);
        memory.recentYou.push(last.you);
        if (memory.recentOpp.length > 12) memory.recentOpp.shift();
        if (memory.recentYou.length > 12) memory.recentYou.shift();
    }

    if (round === 0) return ["C", memory];
    if (round === 1) return ["C", memory];
    if (round === 2) return ["D", memory];
    if (round === 3) return ["C", memory];

    if (!memory.testDone) {
        const opp = history.slice(0, 4).map(m => m.opponent);
        const dCount = opp.filter(x => x === "D").length;

        if (dCount === 0) {
            memory.mode = "exploit";
        } else if (dCount >= 3) {
            memory.mode = "defend";
        } else {
            memory.mode = "coop";
        }

        memory.testDone = true;
    }

    const total = memory.oppC + memory.oppD;
    const coopRate = total > 0 ? memory.oppC / total : 1;
    const lastOpp = memory.recentOpp[memory.recentOpp.length - 1];
    const last2Opp = memory.recentOpp.slice(-2);
    const last3Opp = memory.recentOpp.slice(-3);

    if (total >= 10) {
        if (coopRate < 0.35) memory.mode = "defend";
        else if (coopRate > 0.8) memory.mode = "exploit";
        else memory.mode = "coop";
    }

    if (memory.forgivenessCooldown > 0) memory.forgivenessCooldown--;

    let mutualDStreak = 0;
    for (let i = history.length - 1; i >= 0 && i >= history.length - 6; i--) {
        if (history[i].you === "D" && history[i].opponent === "D") mutualDStreak++;
        else break;
    }

    if (mutualDStreak >= 3 && memory.forgivenessCooldown === 0) {
        memory.forgivenessCooldown = 6;
        return ["C", memory]; // one olive branch
    }

    const lateGame = round >= 90;

    if (memory.mode === "defend") {
        if (round % 11 === 0 && coopRate > 0.15) return ["C", memory];
        return ["D", memory];
    }

    if (memory.mode === "exploit") {
        if (last2Opp.length === 2 && last2Opp[0] === "D" && last2Opp[1] === "D") {
            memory.mode = "coop";
            return ["C", memory];
        }

        memory.exploitStep = (memory.exploitStep + 1) % 5;
        if (memory.exploitStep === 0) return ["D", memory];

        if (lateGame && round % 7 === 0 && coopRate > 0.9) return ["D", memory];

        return ["C", memory];
    }

    const recentD3 = last3Opp.filter(x => x === "D").length;

    if (lastOpp === "D") {
        if (recentD3 >= 2) return ["D", memory];
        return ["C", memory];
    }

    return ["C", memory];
}