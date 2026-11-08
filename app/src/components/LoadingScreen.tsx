import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { bigUsbXml, flyMiniXml } from '../brand/art';
import { colors } from '../theme';

const FLIES = 7;
const FLY_SIZE = 46;

interface Props {
  /** Cuando pasa a true, la pantalla se desvanece y llama a onFinish. */
  done: boolean;
  onFinish: () => void;
}

/** Pantalla de carga: USB en el centro, nombre debajo y moscas volando hacia la memoria. */
export function LoadingScreen({ done, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const usbWidth = Math.min(width * 0.62, 300);
  const usbHeight = usbWidth / 2;
  const center = { x: width / 2, y: height * 0.42 };

  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const buzz = useRef(new Animated.Value(0)).current;
  const progress = useRef([...Array(FLIES)].map(() => new Animated.Value(0))).current;

  // Trayectoria de cada mosca: sale de fuera de la pantalla y se acerca a la USB zigzagueando.
  const flights = useMemo(() => {
    const far = Math.hypot(width, height) * 0.6;
    const near = usbWidth * 0.42;
    return progress.map((_, i) => {
      const angle = (i / FLIES) * Math.PI * 2 + 0.4;
      const steps = [0, 0.2, 0.4, 0.6, 0.8, 1];
      const xs: number[] = [];
      const ys: number[] = [];
      steps.forEach((t, k) => {
        const radius = far + (near - far) * t;
        const wobble = (k % 2 === 0 ? 1 : -1) * 28 * (1 - t); // zigzag que se calma al llegar
        const a = angle + wobble / radius;
        xs.push(center.x + Math.cos(a) * radius - FLY_SIZE / 2);
        ys.push(center.y + Math.sin(a) * radius - FLY_SIZE / 2);
      });
      // La cabeza (arriba en el dibujo) apunta hacia la USB.
      const heading = (angle * 180) / Math.PI + 270;
      return { steps, xs, ys, heading };
    });
  }, [width, height, usbWidth, center.x, center.y, progress]);

  useEffect(() => {
    const loops = progress.map((p, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 260),
          Animated.timing(p, {
            toValue: 1,
            duration: 1900 + (i % 3) * 350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const buzzLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buzz, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(buzz, { toValue: -1, duration: 140, useNativeDriver: true }),
        Animated.timing(buzz, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]),
    );
    [...loops, pulseLoop, buzzLoop].forEach((a) => a.start());
    return () => [...loops, pulseLoop, buzzLoop].forEach((a) => a.stop());
  }, [progress, pulse, buzz]);

  useEffect(() => {
    if (!done) return;
    Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [done, fade, onFinish]);

  const usbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <Animated.View style={[styles.overlay, { opacity: fade, pointerEvents: done ? 'none' : 'auto' }]}>
      {flights.map((f, i) => {
        const p = progress[i];
        const wiggle = buzz.interpolate({ inputRange: [-1, 1], outputRange: [`${f.heading - 7}deg`, `${f.heading + 7}deg`] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.fly,
              {
                opacity: p.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: p.interpolate({ inputRange: f.steps, outputRange: f.xs }) },
                  { translateY: p.interpolate({ inputRange: f.steps, outputRange: f.ys }) },
                  { rotate: wiggle },
                  { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.7] }) },
                ],
              },
            ]}
          >
            <SvgXml xml={flyMiniXml} width={FLY_SIZE} height={FLY_SIZE} />
          </Animated.View>
        );
      })}

      <Animated.View
        style={[
          styles.usb,
          { left: center.x - usbWidth / 2, top: center.y - usbHeight / 2, transform: [{ scale: usbScale }] },
        ]}
      >
        <SvgXml xml={bigUsbXml} width={usbWidth} height={usbHeight} />
      </Animated.View>

      <View style={[styles.texts, { top: center.y + usbHeight / 2 + 28 }]}>
        <Text style={styles.name}>
          Las Moscas<Text style={{ color: colors.accent }}>Stream</Text>
        </Text>
        <Text style={styles.subtitle}>Cargando catálogo…</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 100 },
  fly: { position: 'absolute', left: 0, top: 0, width: FLY_SIZE, height: FLY_SIZE },
  usb: { position: 'absolute' },
  texts: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  name: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
});
