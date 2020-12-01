import { IMusicMeta, IUnitProfile } from "./../types.d";
import Axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { WebpMachine } from "webp-hero";
import PQueue from "p-queue";
import localforage from "localforage";
import {
  IGachaInfo,
  ICardInfo,
  IGameChara,
  IMusicInfo,
  ISkillInfo,
  ICardRarity,
  ICharacterRank,
  IMusicVocalInfo,
  IOutCharaProfile,
  IUserInformationInfo,
  IMusicDifficultyInfo,
  IMusicTagInfo,
  IReleaseCondition,
  IMusicDanceMembers,
  IEventInfo,
  IEventDeckBonus,
  IGameCharaUnit,
  IEventRealtimeRank,
  IResourceBoxInfo,
  IHonorInfo,
  ICardEpisode,
  ContentTransModeType,
  ITipInfo,
  ICharaProfile,
} from "../types";
import { useAssetI18n } from "./i18n";

const webpMachine = new WebpMachine();

export function useRefState<S>(
  initialValue: S
): [S, React.MutableRefObject<S>, React.Dispatch<React.SetStateAction<S>>] {
  const [state, setState] = useState(initialValue);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  return [state, stateRef, setState];
}

let masterDataCache: { [key: string]: any[] } = {};

export function useCachedData<
  T extends
    | IGachaInfo
    | ICardInfo
    | IGameChara
    | IMusicInfo
    | ISkillInfo
    | ICardRarity
    | ICharacterRank
    | IMusicVocalInfo
    | IOutCharaProfile
    | IUserInformationInfo
    | IMusicDifficultyInfo
    | IMusicTagInfo
    | IReleaseCondition
    | IMusicDanceMembers
    | IEventInfo
    | IEventDeckBonus
    | IGameCharaUnit
    | IResourceBoxInfo
    | IHonorInfo
    | ICardEpisode
    | ITipInfo
    | ICharaProfile
    | IUnitProfile
>(name: string): [T[], React.MutableRefObject<T[]>] {
  const [cached, cachedRef, setCached] = useRefState<T[]>([]);

  const fetchCached = useCallback(async () => {
    const { data }: { data: T[] } = await Axios.get(
      `https://sekai-world.github.io/sekai-master-db-diff/${name}.json`
    );
    return data;
  }, [name]);

  useEffect(() => {
    if (masterDataCache[name] && masterDataCache[name].length)
      setCached(masterDataCache[name]);
    else
      fetchCached().then((data) => {
        setCached(data);
        masterDataCache[name] = data;
      });
  }, [fetchCached, name, setCached]);

  return [cached, cachedRef];
}

export function useRealtimeEventData(
  eventId: number
): [
  () => Promise<IEventRealtimeRank>,
  IEventRealtimeRank,
  React.MutableRefObject<IEventRealtimeRank>
] {
  const [
    eventRealtimeData,
    eventRealtimeDataRef,
    setEventRealtimeData,
  ] = useRefState<IEventRealtimeRank>({
    time: 0,
    first10: [],
    rank20: [],
    rank30: [],
    rank40: [],
    rank50: [],
    rank100: [],
    rank200: [],
    rank300: [],
    rank400: [],
    rank500: [],
    rank1000: [],
    rank2000: [],
    rank3000: [],
    rank4000: [],
    rank5000: [],
    rank10000: [],
    rank20000: [],
    rank30000: [],
    rank40000: [],
    rank50000: [],
    rank100000: [],
  });

  const refreshData = useCallback(async () => {
    const { data }: { data: IEventRealtimeRank } = await Axios.get(
      `https://bitbucket.org/sekai-world/sekai-event-track/raw/main/event${eventId}.json?t=${Date.now()}`
    );

    setEventRealtimeData(data);
    return data;
  }, [eventId, setEventRealtimeData]);

  return [refreshData, eventRealtimeData, eventRealtimeDataRef];
}

export const musicCategoryToName: { [key: string]: string } = {
  mv: "3D MV",
  original: "Original MV",
  sekai: "Sekai MV",
  image: "Static Image",
  mv_2d: "2D MV",
};

export const musicTagToName: { [key: string]: string } = {
  all: "All",
  vocaloid: "Vocaloid",
  light_music_club: "Light Music Club",
  idol: "Idol",
  school_refusal: "School Refusal",
  theme_park: "Theme Park",
  street: "Street",
};

export function useCharaName(contentTransMode: ContentTransModeType) {
  const [charas] = useCachedData<IGameChara>("gameCharacters");
  const { assetT, assetI18n } = useAssetI18n();
  return useCallback(
    (charaId: number): string | undefined => {
      const chara = charas.find((chara) => chara.id === charaId);
      if (chara?.firstName) {
        switch (contentTransMode) {
          case "original":
            return `${chara.firstName} ${chara.givenName}`;
          case "translated":
            return ["zh-CN", "zh-TW", "ko", "ja"].includes(assetI18n.language)
              ? `${assetT(
                  `character_name:${charaId}.firstName`,
                  chara.firstName
                )} ${assetT(
                  `character_name:${charaId}.givenName`,
                  chara.givenName
                )}`
              : `${assetT(
                  `character_name:${charaId}.givenName`,
                  chara.givenName
                )} ${assetT(
                  `character_name:${charaId}.firstName`,
                  chara.firstName
                )}`;
          case "both":
            return (
              `${chara.firstName} ${chara.givenName} | ` +
              (["zh-CN", "zh-TW", "ko", "ja"].includes(assetI18n.language)
                ? `${assetT(
                    `character_name:${charaId}.firstName`,
                    chara.firstName
                  )} ${assetT(
                    `character_name:${charaId}.givenName`,
                    chara.givenName
                  )}`
                : `${assetT(
                    `character_name:${charaId}.givenName`,
                    chara.givenName
                  )} ${assetT(
                    `character_name:${charaId}.firstName`,
                    chara.firstName
                  )}`)
            );
        }
      }
      return chara?.givenName;
    },
    [assetI18n.language, assetT, charas, contentTransMode]
  );
}

export function useMuisicMeta(): [
  IMusicMeta[],
  React.MutableRefObject<IMusicMeta[]>
] {
  const [cached, cachedRef, setCached] = useRefState<IMusicMeta[]>([]);

  const fetchCached = useCallback(async () => {
    const { data }: { data: IMusicMeta[] } = await Axios.get(
      process.env.PUBLIC_URL + "/metas.json"
    );
    //console.log(data.length);
    return data;
  }, []);

  useEffect(() => {
    let name = "metas";
    if (masterDataCache[name] && masterDataCache[name].length)
      setCached(masterDataCache[name]);
    else
      fetchCached().then((data) => {
        setCached(data);
        masterDataCache[name] = data;
      });
  }, [fetchCached, setCached]);

  return [cached, cachedRef];
}

const queue = new PQueue({ concurrency: 1 });

export async function getRemoteAssetURL(
  endpoint: string,
  setFunc?: CallableFunction
): Promise<string> {
  const isWebpSupported = Modernizr.webplossless;
  const url = `${process.env.REACT_APP_ASSET_DOMAIN}/file/sekai-assets/${endpoint}`;

  if (endpoint.endsWith(".webp") && !isWebpSupported) {
    let dataUrl = await localforage.getItem<string>(url);
    if (!dataUrl) {
      const res = await Axios.get(url, { responseType: "arraybuffer" });
      dataUrl = await queue.add<string>(() =>
        webpMachine.decode(new Uint8Array(res.data))
      );
      await localforage.setItem(url, dataUrl);
      if (setFunc) setFunc(dataUrl);
      return dataUrl;
    } else {
      if (setFunc) setFunc(dataUrl);
      return dataUrl;
    }
  } else {
    if (setFunc) setFunc(url);
    return url;
  }
}
