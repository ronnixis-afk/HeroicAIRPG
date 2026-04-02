
// constants/storyHooks.ts

export type SettingType = 'Fantasy' | 'Sci-Fi' | 'Modern' | 'Magitech';

export const STORY_HOOKS: Record<SettingType, string[]> = {
    'Fantasy': [
        "Receiving an ornate, locked chest for \"services yet to be rendered\" while a terrified observer watches.",
        "Arriving with a letter of recommendation only to find the author was executed for treason this morning.",
        "Receiving an inheritance from a deceased relative, but being met by a collector seeking a \"blood tax.\"",
        "Meeting a dying traveler clutching a map to a hidden stronghold who begs you to deliver a warning.",
        "Stopped by a blockade where an officer recognizes your gear as belonging to a hero who vanished decades ago.",
        "Following a vision to a contact who claims your arrival was prophesied and your wealth is a \"key.\"",
        "Discovering a village that has been frozen in time for a century, where everyone awakens as you enter.",
        "Waking up in a forest clearing with a silver flute that attracts woodland spirits, but reveals a dark secret."
    ],
    'Sci-Fi': [
        "Arriving at a prestigious summit to receive a reward, only for a local to warn it's a tracker for a rival group.",
        "Signaling distress while finalizing a supply contract; a stranger offers double pay to ignore orders.",
        "Surrounded by a strike team after purchasing a rare artifact from a major power's merchant.",
        "Witnessing a high-ranking official collapse, who hands you a keycard and a warning with their final breath.",
        "Discovering a cache of elite gear marked with a major power's seal, intended for a high-stakes assassination.",
        "Waking on a luxury transport with no memory of a \"completed heist\" that authorities are currently investigating.",
        "Finding a glowing beacon in your gear that makes you the most wanted person in the region.",
        "Receiving an encrypted transmission from a space station that was officially decommissioned decades ago."
    ],
    'Modern': [
        "Arriving at a prestigious summit to receive a reward, only for a local to warn it's a tracker for a rival group.",
        "Returning to a luxury suite to find a mysterious figure claiming your recent earnings were stolen from them.",
        "Approached at a gala by someone who knows your history and offers a reward for a high-stakes betrayal.",
        "A stranger pursued by a dominant power crashes through your window, offering a massive bribe for escort.",
        "Hired as a decoy for a shipment, only to discover your \"decoy\" cargo is the real, priceless objective.",
        "Finding a discarded phone that rings with a voice claiming to be \"you\" from twenty-four hours in the future.",
        "Witnessing a private exchange of briefcases in an alleyway, only for one participant to vanish in a flash of light.",
        "Receiving an invitation to an exclusive underground club where the entrance fee is a secret you've never told anyone."
    ],
    'Magitech': [
        "Surrounded by a strike team after purchasing a rare artifact from a major power's merchant.",
        "Receiving an ornate, locked chest for \"services yet to be rendered\" while a terrified observer watches.",
        "Summoned to inspect a strange phenomenon that begins reacting to your presence as a SENTIENT weapon.",
        "Winning a private auction for a legendary asset, only for a bystander to scream that the item is a fake.",
        "Finding a glowing beacon in your gear that makes you the most wanted person in the region.",
        "Discovering an ancient, steam-powered automaton in a junkyard that activates and calls you \"Master\".",
        "Arriving at a city powered by captured lightning, only to find the generators are failing as you arrive.",
        "Hired to escort a shipment of \"unstable mana\" which begins to hum in resonance with your heartbeat."
    ]
};

