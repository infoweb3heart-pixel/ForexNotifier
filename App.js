import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const NIGERIA_TZ = 'Africa/Lagos';

const FOREX_SESSIONS = [
  { name: 'Tokyo', gmtStart: 22, gmtEnd: 7, color: '#FF6B6B' },
  { name: 'London', gmtStart: 8, gmtEnd: 17, color: '#4ECDC4' },
  { name: 'New York', gmtStart: 13, gmtEnd: 22, color: '#FFD93D' },
];

export default function App() {
  const [time, setTime] = useState(dayjs().tz(NIGERIA_TZ).format('HH:mm:ss'));
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const updateTime = () => {
      const now = dayjs().tz(NIGERIA_TZ);
      setTime(now.format('HH:mm:ss'));
      
      const sessionData = FOREX_SESSIONS.map((session) => {
        const startTime = dayjs().tz(NIGERIA_TZ).hour(session.gmtStart + 1).minute(0);
        const endTime = dayjs().tz(NIGERIA_TZ).hour(session.gmtEnd + 1).minute(0);
        const isActive = now.hour() >= session.gmtStart + 1 && now.hour() < session.gmtEnd + 1;
        
        return { ...session, startTime, endTime, isActive };
      });
      
      setSessions(sessionData);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Forex Sessions</Text>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.date}>{dayjs().tz(NIGERIA_TZ).format('dddd, MMM D')}</Text>
        <Text style={styles.timezone}>Lagos, Nigeria (UTC+1)</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {sessions.map((session, idx) => (
          <View key={idx} style={[styles.card, session.isActive && styles.activeCard]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sessionName, session.isActive && styles.activeText]}>
                {session.name}
              </Text>
              <Text style={session.isActive ? styles.activeBadge : styles.closedBadge}>
                {session.isActive ? '● LIVE' : '○ Closed'}
              </Text>
            </View>
            <Text style={styles.timeText}>
              {session.startTime.format('HH:mm')} - {session.endTime.format('HH:mm')} NGT
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

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
  activeText: {
    color: '#00ff88',
  },
  activeBadge: {
    backgroundColor: '#00ff88',
    color: '#0a0e27',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  closedBadge: {
    backgroundColor: '#333',
    color: '#888',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  timeText: {
    fontSize: 14,
    color: '#aaa',
  },
});
