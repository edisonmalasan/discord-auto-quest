// Development-only visual fixtures. Not imported by the production entry.
// ?scale=2 exercises 200% text/layout zoom without changing system settings.
import { createRoot } from 'react-dom/client';
import '../index.css';
import { QuestWorkspace } from '../components/QuestWorkspace';
import { buildQuestViews } from '../lib/quest-view';
import { makeQuest, makeFeed } from './fixtures/quests';
import type { QuestSummary } from '../types/quests';
if (new URLSearchParams(location.search).get('scale') === '2') {
  document.documentElement.style.setProperty('zoom', '2');
  document.documentElement.style.height = '50vh';
}
const samples = ([
  {
    "id": "1558176501663272961",
    "name": "Clean Crew",
    "gameTitle": "Clean Crew on Roblox",
    "publisher": "ROBLOX",
    "banner": "quests/1558176501663272961/1559972660153163837.jpg",
    "logotype": "quests/1558176501663272961/1559972658987278456.png",
    "ctaLabel": "Play Now",
    "ctaLink": "https://www.roblox.com/games/128637868413472/Clean-Crew?gsrbx=1&ad_name=61EBJ8B7",
    "rewardOrbs": 700,
    "rewardName": "700 Orbs",
    "premiumOrbs": 840,
    "tasks": [
      "PLAY_ON_DESKTOP"
    ],
    "taskDetails": [
      {
        "kind": "PLAY_ON_DESKTOP",
        "value": 0,
        "target": 900,
        "unit": "seconds",
        "platform": "Desktop"
      }
    ],
    "rewardType": "4",
    "rewardImage": null,
    "heroVideo": "quests/1558176501663272961/1559972762724864101_720.mp4",
    "expiresAt": "2099-10-25T00:00:00Z",
    "publisherVerified": true,
    "state": "claimed",
    "selectedTaskKind": "PLAY_ON_DESKTOP"
  },
  {
    "id": "1555080843502813245",
    "name": "Version Update: Si",
    "gameTitle": "Arknights: Endfield",
    "publisher": "GRYPHLINE",
    "banner": "quests/1555080843502813245/1557966706343944203.jpg",
    "logotype": "quests/1534395181334270063/1534399093881704558.png",
    "ctaLabel": "Play Now",
    "ctaLink": "https://akendfield.gryphline.com/d27t/V1D6DPQ",
    "rewardOrbs": 700,
    "rewardName": "700 Orbs",
    "premiumOrbs": 840,
    "tasks": [
      "PLAY_ON_DESKTOP",
      "PLAY_ON_PLAYSTATION"
    ],
    "taskDetails": [
      {
        "kind": "PLAY_ON_DESKTOP",
        "value": 0,
        "target": 900,
        "unit": "seconds",
        "platform": "Desktop"
      },
      {
        "kind": "PLAY_ON_PLAYSTATION",
        "value": 0,
        "target": 900,
        "unit": "seconds",
        "platform": "PlayStation"
      }
    ],
    "rewardType": "4",
    "rewardImage": null,
    "heroVideo": "quests/1555080843502813245/1559503370689978409_720.mp4",
    "expiresAt": "2099-10-25T00:00:00Z",
    "publisherVerified": true,
    "state": "claimed",
    "selectedTaskKind": "PLAY_ON_DESKTOP"
  },
  {
    "id": "1555669093204500591",
    "name": "Save 50% on Topaz Studio",
    "gameTitle": "Add detail and realism to low-res videos",
    "publisher": "Topaz Studio",
    "banner": "quests/1555669093204500591/1560045804025286737.jpg",
    "logotype": "quests/1555669093204500591/1560339800807178322.png",
    "ctaLabel": "Get Offer",
    "ctaLink": "https://www.topazlabs.com/promos/adobe/studio?utm_source=discord&utm_medium=paid_social&utm_campaign=topaz_studio_Oct-Adobe-Promo_20161019",
    "rewardOrbs": 200,
    "rewardName": "200 Orbs",
    "premiumOrbs": 240,
    "tasks": [
      "WATCH_VIDEO",
      "WATCH_VIDEO_ON_MOBILE"
    ],
    "taskDetails": [
      {
        "kind": "WATCH_VIDEO",
        "value": 0,
        "target": 9,
        "unit": "seconds",
        "platform": null
      },
      {
        "kind": "WATCH_VIDEO_ON_MOBILE",
        "value": 0,
        "target": 9,
        "unit": "seconds",
        "platform": "Mobile"
      }
    ],
    "rewardType": "4",
    "rewardImage": null,
    "heroVideo": "quests/1555669093204500591/1560045860962836500_720.mp4",
    "expiresAt": "2099-10-25T00:00:00Z",
    "publisherVerified": true,
    "state": "claimed",
    "selectedTaskKind": "WATCH_VIDEO"
  },
  {
    "id": "1558112706446368769",
    "name": "Royal Match",
    "gameTitle": "Royal Match",
    "publisher": "Dream Games",
    "banner": "quests/1558039850270203925/1558048886562619434.jpg",
    "logotype": "quests/1558039850270203925/1558048699530215445.png",
    "ctaLabel": "Download",
    "ctaLink": "https://www.dreamgames.com/games/royal-match",
    "rewardOrbs": 200,
    "rewardName": "200 Orbs",
    "premiumOrbs": 240,
    "tasks": [
      "WATCH_VIDEO_ON_MOBILE"
    ],
    "taskDetails": [
      {
        "kind": "WATCH_VIDEO_ON_MOBILE",
        "value": 0,
        "target": 58,
        "unit": "seconds",
        "platform": "Mobile"
      }
    ],
    "rewardType": "4",
    "rewardImage": null,
    "heroVideo": "quests/1558039850270203925/1558048991667687506_720.mp4",
    "expiresAt": "2099-10-25T00:00:00Z",
    "publisherVerified": true,
    "state": "available",
    "selectedTaskKind": "WATCH_VIDEO_ON_MOBILE"
  },
  {
    "id": "1560392603877249036",
    "name": "EA SPORTS FC™ 27",
    "gameTitle": "EA SPORTS FC™ 27",
    "publisher": "Electronic Arts",
    "banner": "quests/1551969525602451497/1551981579088298084.jpg",
    "logotype": "quests/1551969525602451497/1551970362521026750.png",
    "ctaLabel": "Get Game",
    "ctaLink": "https://game.ea.com/redirect?campaignName=FC27_UA_US_EA_SOC_DISC_LC&caudience=3P-INT-PLAT-COMPETITIVEGAMING-CLK&ccreative=X_FC27-LA-COLLAGE-LOGO_X_VID_16_2640x740_en-US_HC",
    "rewardOrbs": 700,
    "rewardName": "700 Orbs",
    "premiumOrbs": 840,
    "tasks": [
      "PLAY_ON_DESKTOP",
      "PLAY_ON_XBOX",
      "PLAY_ON_PLAYSTATION"
    ],
    "taskDetails": [
      {
        "kind": "PLAY_ON_DESKTOP",
        "value": 0,
        "target": 900,
        "unit": "seconds",
        "platform": "Desktop"
      },
      {
        "kind": "PLAY_ON_XBOX",
        "value": 0,
        "target": 900,
        "unit": "seconds",
        "platform": "Xbox"
      },
      {
        "kind": "PLAY_ON_PLAYSTATION",
        "value": 0,
        "target": 900,
        "unit": "seconds",
        "platform": "PlayStation"
      }
    ],
    "rewardType": "4",
    "rewardImage": null,
    "heroVideo": "quests/1560392603877249036/1560732962574704770_720.mp4",
    "expiresAt": "2099-10-25T00:00:00Z",
    "publisherVerified": true,
    "state": "available",
    "selectedTaskKind": "PLAY_ON_DESKTOP"
  },
  {
    "id": "1552381063475499109",
    "name": "MapleStory Classic World Trailer",
    "gameTitle": "Maple World, exactly as you left it. Free on PC.",
    "publisher": "Nexon America",
    "banner": "quests/1552381063475499109/1560450166996213881.jpg",
    "logotype": "quests/1552381063475499109/1561778867847299093.png",
    "ctaLabel": "Play Now",
    "ctaLink": "https://www.nexon.com/mscw/landing?partnerkey=MK566S59813M37754&utm_source=discord&utm_medium=quest&utm_term=gamesplayed&utm_campaign=mscglipm&utm_content=NA",
    "rewardOrbs": 200,
    "rewardName": "200 Orbs",
    "premiumOrbs": 240,
    "tasks": [
      "WATCH_VIDEO",
      "WATCH_VIDEO_ON_MOBILE"
    ],
    "taskDetails": [
      {
        "kind": "WATCH_VIDEO",
        "value": 0,
        "target": 154,
        "unit": "seconds",
        "platform": null
      },
      {
        "kind": "WATCH_VIDEO_ON_MOBILE",
        "value": 0,
        "target": 154,
        "unit": "seconds",
        "platform": "Mobile"
      }
    ],
    "rewardType": "4",
    "rewardImage": null,
    "heroVideo": "quests/1552381063475499109/1560450212571517000_720.mp4",
    "expiresAt": "2099-10-25T00:00:00Z",
    "publisherVerified": true,
    "state": "completed",
    "selectedTaskKind": "WATCH_VIDEO",
    "rewardClaimState": "claimed",
    "rewardClaimedAt": "2026-10-22T12:00:00Z",
    "completedAt": "2026-10-22T11:00:00Z",
    "claimedRewardOrbs": 200
  }
] as Partial<QuestSummary>[]).map(makeQuest);
const views=buildQuestViews(makeFeed({claimed:samples.filter(q=>q.state!=='available'),available:samples.filter(q=>q.state==='available')}),Date.now());
createRoot(document.getElementById('root')!).render(<QuestWorkspace views={views} loading={false} stale={false} controls={<button className="button primary" disabled>Work my quests</button>} connection={<div className="connection"><p><span className="status-dot connected"/>Discord connected</p><span className="connection-detail">Visual fixtures · sample data</span></div>}/>);
