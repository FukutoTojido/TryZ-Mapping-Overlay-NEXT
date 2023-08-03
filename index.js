import osuPerformance from "./deps/osujs.js";

const HOST = window.location.host;
const ws = new window.ReconnectingWebSocket(`ws://${HOST}/ws`);

ws.onopen = () => {
    console.log("gosumemory WebSocket connected!");
};

ws.onclose = () => {
    console.log("gosumemory WebSocket closed!");
};

const cache = {
    backgroundImage: "",
    artist: "",
    title: "",
    difficulty: "",
    mapper: "",
    path: "",
    text: "",
    pp: 0,
};

ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.menu.bm.path.full !== cache.backgroundImage) {
        cache.backgroundImage = data.menu.bm.path.full;
        const url = `http://${HOST}/Songs/${encodeURIComponent(cache.backgroundImage.replaceAll(/\\/g, "/"))}`;
        document.querySelector("#bg").style.backgroundImage = `url('${url.replace(/'/g, "%27")}')`;
    }

    if (data.menu.bm.metadata.artist !== cache.artist) {
        cache.artist = data.menu.bm.metadata.artist;
        document.querySelector("#artist").innerText = cache.artist;
    }

    if (data.menu.bm.metadata.title !== cache.title) {
        cache.title = data.menu.bm.metadata.title;
        document.querySelector("#title").innerText = cache.title;
    }

    if (data.menu.bm.metadata.difficulty !== cache.difficulty) {
        cache.difficulty = data.menu.bm.metadata.difficulty;
        document.querySelector("#difficulty").innerText = cache.difficulty;
    }

    if (data.menu.bm.metadata.mapper !== cache.mapper) {
        cache.mapper = data.menu.bm.metadata.mapper;
        document.querySelector("#mapper").innerText = cache.mapper;
    }

    if (data.menu.pp["100"] !== cache.pp) {
        cache.pp = data.menu.pp["100"];
        document.querySelector("#PP").innerText = `${cache.pp}pp`;
    }

    MapReader(
        `http://${HOST}/Songs/${encodeURIComponent(data.menu.bm.path.folder.replace(/\\/g, "/"))}/${encodeURIComponent(
            data.menu.bm.path.file.replace(/\\/g, "/")
        )}`,
        data.menu.bm.time.current
    );
};

async function MapReader(path, currentTime) {
    // const start = performance.now();
    const data = await fetch(path, { cache: "no-store" });
    const text = await data.text();

    // if (text === cache.text) return;
    // cache.text = text;

    // const matchDifficutly = text.match(/\[Difficulty\](\r?)\n([A-Za-z]+:[0-9]+(\.[0-9]+)?(\r)?\n)*/gm).shift();
    const matchTimingPoints = text
        .match(/\[TimingPoints\](\r?)\n(-?[0-9]+,-?[0-9]+(\.[0-9]+)?,[0-9]+,[0-9]+,[0-9]+,[0-9]+,(0|1),[0-9]+(\r)?\n)*/gm)
        .shift();

    const timingPointsList = matchTimingPoints.match(/(-?[0-9]+,-?[0-9]+(\.[0-9]+)?,[0-9]+,[0-9]+,[0-9]+,[0-9]+,1,[0-9]+)/g).map((point) => {
        const params = point.split(",");
        return {
            time: parseInt(params[0]),
            BPM: 60000 / parseFloat(params[1]),
        };
    });

    const inheritedList = matchTimingPoints.match(/(-?[0-9]+,-?[0-9]+(\.[0-9]+)?,[0-9]+,[0-9]+,[0-9]+,[0-9]+,(0|1),[0-9]+)/g).map((point) => {
        const params = point.split(",");
        return {
            time: parseInt(params[0]),
            SV: params[6] === "1" ? 1 : -100 / parseFloat(params[1]),
        };
    });

    // console.log(timingPointsList, inheritedList);

    const difficultyAttribute = calculateDifficulty(text);

    document.querySelector("#CS").innerText = difficultyAttribute.stats.circleSize;
    document.querySelector("#AR").innerText = difficultyAttribute.stats.approachRate;
    document.querySelector("#OD").innerText = difficultyAttribute.stats.overallDifficulty;
    document.querySelector("#HP").innerText = difficultyAttribute.stats.drainRate;
    document.querySelector("#SR").innerText = `${difficultyAttribute.stats.starRating.toFixed(2)}*`;

    document.querySelector("#CC").innerText = difficultyAttribute.objectsCount.hitCircles;
    document.querySelector("#SC").innerText = difficultyAttribute.objectsCount.sliders;
    document.querySelector("#MC").innerText = `${difficultyAttribute.maximumCombo}x`;

    document.querySelector("#BPM").innerText = timingPointsList.findLast((point) => point.time <= currentTime)?.BPM.toFixed(2) ?? 0.0;
    document.querySelector("#SV").innerText = inheritedList.findLast((point) => point.time <= currentTime)?.SV.toFixed(2) ?? 0.0;
    document.querySelector("#baseSV").innerText = `x${difficultyAttribute.stats.sliderMultiplier.toFixed(2)} Base`;

    // console.log(performance.now() - start);
    // console.log(difficultyAttribute);
}

function calculateDifficulty(data) {
    const blueprintData = osuPerformance.parseBlueprint(data);
    const builderOptions = {
        addStacking: true,
        mods: [],
    };

    const builtBeatmap = osuPerformance.buildBeatmap(blueprintData, builderOptions);
    const hitCircles = builtBeatmap.hitObjects.filter((o) => o.constructor.name === "HitCircle");
    const sliders = builtBeatmap.hitObjects.filter((o) => o.constructor.name === "Slider");
    const spinners = builtBeatmap.hitObjects.filter((o) => o.constructor.name === "Spinner");
    // console.log(builtBeatmap);
    return {
        stats: {
            ...builtBeatmap.difficulty,
            starRating:
                osuPerformance.calculateDifficultyAttributes(osuPerformance.buildBeatmap(blueprintData, builderOptions), true)[0]?.starRating ?? 0,
        },
        objectsCount: {
            hitCircles: hitCircles.length,
            sliders: sliders.length,
        },
        maximumCombo: hitCircles.length + spinners.length + sliders.reduce((sum, curr) => curr.checkPoints.length + 1 + sum, 0),
    };
}

// (async () => {
//     MapReader(
//         "http://127.0.0.1:24050/Songs/1259066 Hoshii Miki (CV Hasegawa Akiko) - GO MY WAY!!/Hoshii Miki (CV Hasegawa Akiko) - GO MY WAY!! (bossandy) [INS@NE!!].osu",
//         10000
//     );
// })();
