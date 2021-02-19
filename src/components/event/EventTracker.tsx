import {
  Button,
  Container,
  FormControlLabel,
  FormGroup,
  // Divider,
  Grid,
  LinearProgress,
  makeStyles,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import { Alert, Autocomplete } from "@material-ui/lab";
import { CronJob } from "cron";
import React, {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { SettingContext } from "../../context";
import { useLayoutStyles } from "../../styles/layout";
import {
  EventPrediction,
  EventRankingResponse,
  IEventInfo,
  UserRanking,
} from "../../types";
import { useCachedData, useQuery, useToggle } from "../../utils";
import { getEventPred, useCurrentEvent } from "../../utils/apiClient";
import {
  useEventTrackerAPI,
  useRealtimeEventData,
} from "../../utils/eventTracker";
import { useAssetI18n } from "../../utils/i18n";
import { HistoryMobileRow, LiveMobileRow } from "./EventTrackerMobileRow";
// import DegreeImage from "../subs/DegreeImage";
import { HistoryRow, LiveRow } from "./EventTrackerTableRow";

const useStyles = makeStyles(() => ({
  eventSelect: {
    width: "100%",
    maxWidth: 300,
  },
}));

const EventTracker: React.FC<{}> = () => {
  const layoutClasses = useLayoutStyles();
  const classes = useStyles();
  const query = useQuery();
  const theme = useTheme();
  const { t } = useTranslation();
  const { getTranslated } = useAssetI18n();
  const { getLive } = useEventTrackerAPI();
  const { contentTransMode } = useContext(SettingContext)!;
  const [refreshData] = useRealtimeEventData();
  const { currEvent, isLoading: isCurrEventLoading } = useCurrentEvent();

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [events] = useCachedData<IEventInfo>("events");
  const [selectedEvent, setSelectedEvent] = useState<{
    name: string;
    id: number;
  } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState(0);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  const [rtRanking, setRtRanking] = useState<EventRankingResponse[]>([]);
  const [rtTime, setRtTime] = useState<Date>();
  const [historyRanking, setHistoryRanking] = useState<UserRanking[]>([]);
  const [historyTime, setHistoryTime] = useState<Date>();
  const [nextRefreshTime, setNextRefreshTime] = useState<moment.Moment>();
  const [refreshCron, setRefreshCron] = useState<CronJob>();
  const [isFullRank, toggleIsFullRank] = useToggle(false);
  // const [isGetPred, toggleIsGetPred] = useToggle(false);
  const [eventDuration, setEventDuration] = useState(0);
  const [predCron, setPredCron] = useState<CronJob>();
  const [predData, setPredData] = useState<EventPrediction>();

  const fullRank = useMemo(
    () => [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      20,
      30,
      40,
      50,
      100,
      200,
      300,
      400,
      500,
      1000,
      2000,
      3000,
      4000,
      5000,
      10000,
      20000,
      30000,
      40000,
      50000,
      100000,
    ],
    []
  );

  const critialRank = useMemo(
    () => [1, 2, 3, 10, 100, 1000, 5000, 10000, 50000, 100000],
    []
  );

  useEffect(() => {
    document.title = t("title:eventTracker");
  }, [t]);

  useEffect(() => {
    return () => {
      if (refreshCron) refreshCron.stop();
    };
  }, [refreshCron]);

  useEffect(() => {
    return () => {
      if (predCron) predCron.stop();
    };
  }, [predCron]);

  const refreshRealtimeData = useCallback(async () => {
    const data = await getLive();
    setRtRanking(data);
    setRtTime(new Date(data[0].timestamp));
  }, [getLive]);

  const refreshPrediction = useCallback(async () => {
    const data = await getEventPred();
    setPredData(data);
  }, []);

  const getHistoryData = useCallback(
    async (eventId: number) => {
      const data = await refreshData(eventId);
      setHistoryTime(new Date(data.time));
      const rankingData = Object.values(data).filter((elem) =>
        Array.isArray(elem)
      ) as UserRanking[][];
      console.log(Object.values(data), rankingData);
      setHistoryRanking(
        rankingData.reduce(
          (sum, elem) => [...sum, ...elem],
          []
        ) as UserRanking[]
      );
    },
    [refreshData]
  );

  const handleFetchGraph = useCallback(
    async (eventId: number) => {
      if (!events || !events.length) return;
      setSelectedEventId(0);
      setRtRanking([]);
      setRtTime(undefined);
      setHistoryRanking([]);
      setHistoryTime(undefined);

      setFetchProgress(0);
      setIsFetching(true);
      if (!eventId) {
        setIsFetching(false);
        setFetchProgress(0);
        return;
      }

      // real time data
      const event = events.find((elem) => elem.id === eventId)!;
      if (currEvent?.eventId === eventId) {
        // get realtime data from live endpoint
        const currentTime = Date.now();
        if (
          event &&
          currentTime >= event.startAt &&
          currentTime < event.aggregateAt
        ) {
          const cron = new CronJob("10 * * * * *", () => {
            const currentTime = Date.now();
            if (currentTime >= event.aggregateAt) cron.stop();
            else {
              refreshRealtimeData();
              setEventDuration(currentTime - event.startAt);
              setNextRefreshTime(cron.nextDate());
            }
          });
          cron.start();
          setRefreshCron(cron);
          refreshRealtimeData();
          setEventDuration(currentTime - event.startAt);
          setNextRefreshTime(cron.nextDate());

          if (currentTime >= event.startAt + 24 * 3600 * 1000) {
            const predcron = new CronJob("30 * * * *", () => {
              const currentTime = Date.now();
              if (currentTime >= event.rankingAnnounceAt) predcron.stop();
              else {
                refreshPrediction();
                // setNextRefreshTime(cron.nextDate());
              }
            });
            predcron.start();
            setPredCron(predcron);
            refreshPrediction();
          }
        } else if (event && currentTime >= event.aggregateAt) {
          getHistoryData(event.id);
          setEventDuration(event.aggregateAt - event.startAt);
        }
      } else {
        getHistoryData(event.id);
        setEventDuration(event.aggregateAt - event.startAt);
      }

      setSelectedEventId(eventId);
      setIsFetching(false);
    },
    [
      currEvent?.eventId,
      events,
      getHistoryData,
      refreshPrediction,
      refreshRealtimeData,
    ]
  );

  useEffect(() => {
    if (currEvent && events) {
      if (query.get("id") && !Number.isNaN(Number(query.get("id")))) {
        if (events.length) {
          const ev = events.find((elem) => elem.id === Number(query.get("id")));
          if (ev) {
            setSelectedEvent({
              name: getTranslated(
                contentTransMode,
                `event_name:${query.get("id")}`,
                ev.name
              ),
              id: ev.id,
            });
            handleFetchGraph(ev.id);
          }
        }
      } else {
        setSelectedEvent({
          name: getTranslated(
            contentTransMode,
            `event_name:${currEvent.eventId}`,
            currEvent.eventJson.name
          ),
          id: currEvent.eventId,
        });
        handleFetchGraph(currEvent.eventId);
      }
    }
  }, [
    contentTransMode,
    currEvent,
    events,
    getTranslated,
    handleFetchGraph,
    query,
  ]);

  return (
    <Fragment>
      <Typography variant="h6" className={layoutClasses.header}>
        {t("common:eventTracker")}
      </Typography>
      <Container className={layoutClasses.content}>
        <Grid container spacing={1} alignItems="center">
          <Grid item className={classes.eventSelect}>
            <Autocomplete
              options={(events || [])
                .slice()
                .reverse()
                .map((ev) => ({
                  name: getTranslated(
                    contentTransMode,
                    `event_name:${ev.id}`,
                    ev.name
                  ),
                  id: ev.id,
                }))}
              getOptionLabel={(option) => option.name}
              getOptionSelected={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("event:tracker.select.event_name")}
                />
              )}
              value={selectedEvent}
              autoComplete
              onChange={(_, value) => {
                setSelectedEvent(value);
                if (!!value) {
                  setRefreshCron(undefined);
                  setPredCron(undefined);
                  handleFetchGraph(value.id);
                }
              }}
              disabled={isCurrEventLoading || isFetching}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              onClick={() =>
                setSelectedEvent({
                  name: getTranslated(
                    contentTransMode,
                    `event_name:${currEvent.eventId}`,
                    currEvent.eventJson.name
                  ),
                  id: currEvent.eventId,
                })
              }
              disabled={isCurrEventLoading || isFetching}
            >
              {t("event:tracker.button.curr_event")}
            </Button>
          </Grid>
        </Grid>
        {/* <Grid container spacing={1} alignItems="center">
          <Grid item xs={12}>
            <Autocomplete<EventGraphRanking, boolean>
              multiple
              disableCloseOnSelect
              options={[
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                9,
                10,
                20,
                30,
                40,
                50,
                100,
                200,
                300,
                400,
                500,
                1000,
                2000,
                3000,
                4000,
                5000,
                10000,
                20000,
                30000,
                40000,
                50000,
                100000,
              ]}
              getOptionLabel={(opt) => `T${opt}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="standard"
                  label={t("event:tracker.select.rankings")}
                />
              )}
              value={selectedRankings}
              onChange={(_, values) => {
                if (typeof values === "number") {
                  setSelectedRankings([values]);
                } else if (Array.isArray(values)) {
                  setSelectedRankings(values);
                } else {
                  setSelectedRankings([]);
                }
              }}
              autoComplete
              disabled={isFetching}
            />
          </Grid>
        </Grid> */}
        <Grid container spacing={1} alignItems="center">
          {/* <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={() =>
                !!selectedEvent && handleFetchGraph(selectedEvent.id)
              }
              disabled={isFetching}
            >
              {t("event:tracker.button.graph")}
            </Button>
          </Grid> */}
          {isFetching && (
            <Grid item xs={12}>
              <LinearProgress
                variant="buffer"
                value={fetchProgress}
                valueBuffer={fetchProgress}
              />
            </Grid>
          )}
        </Grid>
      </Container>
      {!!selectedEventId &&
        selectedEventId === currEvent.eventId &&
        !!rtRanking.length &&
        !!rtTime && (
          <Fragment>
            <Typography variant="h6" className={layoutClasses.header}>
              {t("event:ranking")}
            </Typography>
            <Container className={layoutClasses.content}>
              <Typography variant="h6">
                {t("event:realtime")} {rtTime.toLocaleString()}
              </Typography>
              {!!nextRefreshTime && (
                <Typography variant="body2" color="textSecondary">
                  {t("event:nextfetch")}: {nextRefreshTime.fromNow()}
                </Typography>
              )}
              {!!predData && (
                <Typography variant="body2" color="textSecondary">
                  {t("event:tracker.pred_at")}:{" "}
                  {new Date(predData.data.ts).toLocaleString()}
                </Typography>
              )}
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isFullRank}
                      onChange={() => toggleIsFullRank()}
                    />
                  }
                  label={t("event:tracker.show_all_rank")}
                />
              </FormGroup>
              {/* <Divider style={{ margin: "1% 0" }} /> */}
              <Alert severity="info" className={layoutClasses.alert}>
                <Typography>
                  {t("event:tracker.tooltip.get_prediction")}
                </Typography>
              </Alert>
              {isMobile ? (
                <Grid container spacing={1}>
                  {events &&
                    (isFullRank ? fullRank : critialRank).map((rank) => (
                      <Grid item xs={12}>
                        <LiveMobileRow
                          rankingData={
                            rtRanking.find((elem) => elem.rank === rank)!
                          }
                          rankingPred={predData?.data[String(rank) as "100"]}
                        />
                      </Grid>
                    ))}
                </Grid>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell align="center">
                          {t("event:ranking")}
                        </TableCell>
                        <TableCell align="center">
                          {t("event:rankingTable.head.userProfile")}
                        </TableCell>
                        <TableCell align="right">
                          {t("event:rankingTable.head.score")}
                        </TableCell>
                        <TableCell align="right">
                          {t("event:rankingTable.head.speed_per_hour")}
                        </TableCell>
                        <TableCell align="right">
                          {t("event:rankingTable.head.prediction")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {events &&
                        (isFullRank ? fullRank : critialRank).map((rank) => (
                          <LiveRow
                            rankingReward={events
                              .find((ev) => ev.id === selectedEventId)!
                              .eventRankingRewardRanges.find(
                                (r) => r.toRank === rank
                              )}
                            rankingData={
                              rtRanking.find((elem) => elem.rank === rank)!
                            }
                            eventDuration={eventDuration}
                            rankingPred={predData?.data[String(rank) as "100"]}
                          />
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Container>
          </Fragment>
        )}
      {!!selectedEventId &&
        selectedEventId !== currEvent.eventId &&
        !!historyRanking.length &&
        !!historyTime && (
          <Fragment>
            <Typography variant="h6" className={layoutClasses.header}>
              {t("event:ranking")}
            </Typography>
            <Container className={layoutClasses.content}>
              <Typography variant="h6">
                {t("event:realtime")} {historyTime.toLocaleString()}
              </Typography>
              {/* <Divider style={{ margin: "1% 0" }} /> */}
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isFullRank}
                      onChange={() => toggleIsFullRank()}
                    />
                  }
                  label={t("event:tracker.show_all_rank")}
                />
              </FormGroup>
              {isMobile ? (
                <Grid container spacing={1}>
                  {events &&
                    (isFullRank ? fullRank : critialRank).map((rank) => (
                      <Grid item xs={12}>
                        <HistoryMobileRow
                          rankingData={
                            historyRanking.find((elem) => elem.rank === rank)!
                          }
                          eventId={selectedEvent!.id}
                        />
                      </Grid>
                    ))}
                </Grid>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell align="center">
                          {t("event:ranking")}
                        </TableCell>
                        <TableCell align="center">
                          {t("event:rankingTable.head.userProfile")}
                        </TableCell>
                        <TableCell align="right">
                          {t("event:rankingTable.head.score")}
                        </TableCell>
                        <TableCell align="right">
                          {t("event:rankingTable.head.speed_per_hour")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {events &&
                        (isFullRank ? fullRank : critialRank).map((rank) => (
                          <HistoryRow
                            rankingReward={events
                              .find((ev) => ev.id === selectedEventId)!
                              .eventRankingRewardRanges.find(
                                (r) => r.toRank === rank
                              )}
                            rankingData={
                              historyRanking.find((elem) => elem.rank === rank)!
                            }
                            eventDuration={eventDuration}
                            eventId={selectedEvent!.id}
                          />
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Container>
          </Fragment>
        )}
    </Fragment>
  );
};

export default EventTracker;
