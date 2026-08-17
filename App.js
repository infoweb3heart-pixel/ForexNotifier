import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, AppState } from 'react-native';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

dayjs.extend(utc);
dayjs.extend(timezone);

// Nigerian timezone (UTC+1)
const NIGERIA_TZ = 'Africa/Lagos';

// Forex sessions in GMT (server time), then converted to Nigeria time
const FOREX_SESSIONS = [
  {
    name: 'Tokyo',
    gmtStart: 22, // 22:00 GMT (6:00 AM JST)
    gmtEnd: 7,   // 07:00 GMT next day (3:00 PM JST)
    color: '#FF6B6B',
  },
  {
    name: 'London',
    gmtStart: 8,  // 08:00 GMT
    gmtEnd: 17,   // 17:00 GMT
    color: '#4ECDC4',
  },
  {
    name: 'New York',
    gmtStart: 13, // 13:00 GMT
    gmtEnd: 22,   // 22:00 GMT
    color: '#FFD93D',
  },
  {
    name: 'Tokyo-London',
    gmtStart: 8,
    gmtEnd: 9,
    color: '#95E1D3',
  },
  {
    name: 'London-NewYork',
    gmtStart: 13,
    gmtEnd: 17,
    color: '#A8E6CF',
  },
];

// Background task name
const FOREX_NOTIFICATION_TASK = 'forex-session-notification-task';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register background task
TaskManager.defineTask(FOREX_NOTIFICATION_TASK, async () => {
  const now = dayjs().tz(NIGERIA_TZ);
  const currentHour = now.hour();
  const currentDay = now.day();

  // Don't run on weekends
  if (currentDay === 0 || currentDay === 6) return BackgroundFetch.BackgroundFetchResult.NoData;

  const sessionStatus = checkActiveSessions(currentHour);

  if (sessionStatus.starting.length > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚀 Forex Session Starting',
        body: `${sessionStatus.starting.join(', ')} session is now ACTIVE!`,
        sound: true,
        badge: 1,
      },
      trigger: null, // Immediate
    });
  }

  if (sessionStatus.ending.length > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏹️ Forex Session Ending',
        body: `${sessionStatus.ending.join(', ')} session closes in 5 mins`,
        sound: true,
        badge: 1,
      },
      trigger: null,
    });
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

const checkActiveSessions = (currentHour) => {
  const starting = [];
  const ending = [];

  FOREX_SESSIONS.forEach((session) => {
    if (session.gmtStart === currentHour) starting.push(session.name);
    if (session.gmtEnd === currentHour) ending.push(session.name);
  });

  return { starting, ending };
};

const calculateSessionTimes = () => {
  const now = dayjs().tz(NIGERIA_TZ);
  const currentDay = now.day();
  
  // If weekend, return empty or show "Market Closed"
  const isWeekend = currentDay === 0 || currentDay === 6;

  return FOREX_SESSIONS.map((session) => {
    let startTime, endTime;
    let isActive = false;
    let progress = 0;

    if (!isWeekend) {
      // Convert GMT times to Nigeria time
      startTime = dayjs().tz(NIGERIA_TZ).hour(session.gmtStart + 1).minute(0).second(0); // +1 for UTC+1
      endTime = dayjs().tz(NIGERIA_TZ).hour(session.gmtEnd + 1).minute(0).second(0);

      // Handle sessions that cross midnight (Tokyo)
      if (session.gmtStart > session.gmtEnd) {
        if (now.hour() >= session.gmtStart + 1 || now.hour() < session.gmtEnd + 1) {
          isActive = true;
          const sessionStart = dayjs().tz(NIGERIA_TZ).hour(session.gmtStart + 1).minute(0).second(0);
          const sessionEnd = dayjs().tz(NIGERIA_TZ).hour(session.gmtEnd + 1).minute(0).second(0).add(1, 'day');
          progress = ((now - sessionStart) / (sessionEnd - sessionStart)) * 100;
        }
      } else {
        isActive = now.hour() >= session.gmtStart + 1 && now.hour() < session.gmtEnd + 1;
        progress = ((now.hour() - (session.gmtStart + 1)) / (session.gmtEnd - session.gmtStart)) * 100;
      }
    }

    return {
      ...session,
      startTime,
      endTime,
      isActive,
      progress: Math.max(0, Math.min(100, progress)),
      isWeekend,
    };
  });
};

const getTimeUntilNextSession = () => {
  const now = dayjs().tz(NIGERIA_TZ);
  const currentDay = now.day();

  if (currentDay === 0 || currentDay === 6) {
    const nextMonday = now.add(1, 'week').day(1).hour(23).minute(0).second(0);
    return now.to(nextMonday);
  }

  const nextSessionStart = dayjs().tz(NIGERIA_TZ).hour(23).minute(0).second(0);
  if (now.isAfter(nextSessionStart)) {
    return now.to(nextSessionStart.add(1, 'day'));
  }
  return now.to(nextSessionStart);
};

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [time, setTime] = useState(dayjs().tz(NIGERIA_TZ).format('HH:mm:ss'));
  const [appState, setAppState] = useState(AppState.currentState);
  const appStateRef = useRef(AppState.currentState);

  // Initialize notifications on app load
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Notification permission denied');
      }

      // Register background task
      try {
        await BackgroundFetch.registerTaskAsync(FOREX_NOTIFICATION_TASK, {
          minimumInterval: 60 * 5, // Check every 5 minutes
          stopOnTerminate: false,
          startOnBoot: true,
        });
      } catch (err) {
        console.log('Background fetch registration failed:', err);
      }
    })();
  }, []);

  // Listen to app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = (state) => {
    appStateRef.current = state;
    setAppState(state);
  };

  // Update sessions and time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = dayjs().tz(NIGERIA_TZ);
      setTime(now.format('HH:mm:ss'));
      setSessions(calculateSessionTimes());
    }, 1000);

    setSessions(calculateSessionTimes());
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Forex Sessions</Text>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.date}>{dayjs().tz(NIGERIA_TZ).format('dddd, MMM D')}</Text>
        <Text style={styles.timezone}>Lagos, Nigeria (UTC+1)</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading sessions...</Text>
          </View>
        ) : sessions[0].isWeekend ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>🎉 Market Closed (Weekend)</Text>
            <Text style={styles.emptySubtext}>Next session: Monday at 11 PM</Text>
          </View>
        ) : (
          sessions.map((session, idx) => (
            <SessionCard key={idx} session={session} />
          ))
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Notifications enabled • Background running</Text>
      </View>
    </View>
  );
}

const SessionCard = ({ session }) => {
  if (session.name.includes('-')) {
    // Overlap sessions - smaller card
    return (
      <View style={[styles.card, styles.overlapCard, { borderLeftColor: session.color }]}>
        <Text style={styles.sessionName}>{session.name} Overlap</Text>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {session.startTime?.format('HH:mm')} - {session.endTime?.format('HH:mm')}
          </Text>
          <Text style={styles.statusBadge} style={session.isActive ? styles.activeBadge : styles.inactiveBadge}>
            {session.isActive ? '● ACTIVE' : '○ Closed'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, session.isActive && styles.activeCard]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.sessionName, session.isActive && styles.activeSessionName]}>
          {session.name} Session
        </Text>
        <Text style={[styles.statusBadge, session.isActive ? styles.activeBadge : styles.inactiveBadge]}>
          {session.isActive ? '● LIVE' : '○ Closed'}
        </Text>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {session.startTime?.format('HH:mm')} - {session.endTime?.format('HH:mm')} NGT
        </Text>
      </View>

      {session.isActive && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${session.progress}%`, backgroundColor: session.color },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(session.progress)}% through</Text>
        </View>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f3a',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  time: {
    fontSize: 48,
    fontWeight: '300',
    color: '#00ff88',
    letterSpacing: 2,
  },
  date: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  timezone: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#444',
  },
  activeCard: {
    backgroundColor: '#1a2f2a',
    borderLeftColor: '#00ff88',
  },
  overlapCard: {
    backgroundColor: '#2a2a3a',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ccc',
  },
  activeSessionName: {
    color: '#00ff88',
    fontSize: 20,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeBadge: {
    backgroundColor: '#00ff88',
    color: '#0a0e27',
  },
  inactiveBadge: {
    backgroundColor: '#333',
    color: '#888',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'Courier New',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    textAlign: 'right',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1f3a',
    backgroundColor: '#0a0e27',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
