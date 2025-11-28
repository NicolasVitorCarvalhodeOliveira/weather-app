import * as React from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import Toast from "react-native-toast-message";


/**
 * @typedef {Object} WeatherDay
 * @property {string} weekDayLabel
 * @property {number} min
 * @property {number} max
 * @property {"sun"|"cloud"|"rain"} icon
 */

/**
 * @typedef {Object} CityWeather
 * @property {string} cityName
 * @property {string} description
 * @property {string} dateTimeLabel
 * @property {number} currentTemp
 * @property {number} minTemp
 * @property {number} maxTemp
 * @property {string} precipitationLabel
 * @property {string} humidityLabel
 * @property {string} windLabel
 * @property {"sun"|"cloud"|"rain"} iconKind
 * @property {WeatherDay[]} daily
 */

/**
 * @typedef {Object} CitySuggestion
 * @property {string} id
 * @property {string} label
 * @property {number} lat
 * @property {number} lon
 */

const OPEN_WEATHER_KEY = "c79159a63529d90500aeb1c6472dc35a";
const OPEN_WEATHER_BASE = "https://api.openweathermap.org/data/2.5";

/**
 * Monta URL para clima atual por coordenadas.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
const buildCurrentWeatherUrlFromCoords = (lat, lon) =>
  `${OPEN_WEATHER_BASE}/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_KEY}&units=metric&lang=pt_br`;

/**
 * Monta URL para previsão por coordenadas.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
const buildForecastUrlFromCoords = (lat, lon) =>
  `${OPEN_WEATHER_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_KEY}&units=metric&lang=pt_br`;

/**
 * Monta URL para geocoding direto (busca de cidades).
 * @param {string} query
 * @param {number} limit
 * @returns {string}
 */
const buildGeoDirectUrl = (query, limit) => {
  const encoded = encodeURIComponent(query);
  return `https://api.openweathermap.org/geo/1.0/direct?q=${encoded}&limit=${limit}&appid=${OPEN_WEATHER_KEY}`;
};

/**
 * @typedef {"success"|"error"} ToastKind
 */

/**
 * Mostra um toast genérico.
 * Ao tocar no toast ele é fechado.
 * @param {"success"|"error"} kind
 * @param {string} title
 * @param {string} message
 * @returns {void}
 */
const showToast = (kind, title, message) => {
  Toast.show({
    type: kind,
    text1: title,
    text2: message,
    position: "top",
    autoHide: true,
    visibilityTime: 2500,
    onPress: () => {
      Toast.hide();
    },
  });
};


/**
 * Cria label de dia da semana em pt-BR (ex.: "qui.").
 * @param {string} isoDate
 * @returns {string}
 */
const formatWeekdayLabel = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00`);
  const full = date.toLocaleDateString("pt-BR", { weekday: "short" });
  return full.endsWith(".") ? full : `${full}.`;
};

/**
 * Retorna tipo de ícone (ensolarado/nublado/chuvoso).
 * @param {string[]} mains
 * @returns {"sun"|"cloud"|"rain"}
 */
const pickWeatherIconKind = (mains) => {
  const merged = mains.join(" ").toLowerCase();

  if (
    merged.includes("rain") ||
    merged.includes("drizzle") ||
    merged.includes("thunderstorm")
  ) {
    return "rain";
  }

  if (
    merged.includes("cloud") ||
    merged.includes("mist") ||
    merged.includes("fog") ||
    merged.includes("haze") ||
    merged.includes("smoke")
  ) {
    return "cloud";
  }

  return "sun";
};

/**
 * Agrupa previsão em dias.
 * @param {any[]} list
 * @returns {WeatherDay[]}
 */
const makeDailyFromForecast = (list) => {
  /** @type {Record<string, {min:number,max:number,mains:string[]}>} */
  const byDay = {};

  list.forEach((item) => {
    const [dateOnly] = item.dt_txt.split(" ");
    const mainTemp = item.main.temp;
    const mainWeather = item.weather?.[0]?.main || "Clear";

    if (!byDay[dateOnly]) {
      byDay[dateOnly] = {
        min: mainTemp,
        max: mainTemp,
        mains: [mainWeather],
      };
    } else {
      byDay[dateOnly].min = Math.min(byDay[dateOnly].min, mainTemp);
      byDay[dateOnly].max = Math.max(byDay[dateOnly].max, mainTemp);
      byDay[dateOnly].mains.push(mainWeather);
    }
  });

  return Object.keys(byDay)
    .slice(0, 6)
    .map((isoDate) => {
      const info = byDay[isoDate];
      return {
        weekDayLabel: formatWeekdayLabel(isoDate),
        min: Math.round(info.min),
        max: Math.round(info.max),
        icon: pickWeatherIconKind(info.mains),
      };
    });
};

/**
 * Cria label de precipitação a partir do primeiro item do forecast.
 * @param {any[]} list
 * @returns {string}
 */
const makePrecipitationLabel = (list) => {
  if (!list || list.length === 0) return "Chuva: --%";
  const pop = list[0].pop ?? 0;
  return `Chuva: ${Math.round(pop * 100)}%`;
};

/**
 * Constrói CityWeather a partir das respostas das APIs.
 * @param {any} currentJson
 * @param {any} forecastJson
 * @returns {CityWeather}
 */
const makeCityWeatherFromApi = (currentJson, forecastJson) => {
  const daily = makeDailyFromForecast(forecastJson.list || []);

  const localEpoch = (currentJson.dt || 0) + (currentJson.timezone || 0);
  const localDate = new Date(localEpoch * 1000);
  const weekday = localDate.toLocaleDateString("pt-BR", { weekday: "long" });
  const hour = localDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const description = currentJson.weather?.[0]?.description || "";
  const descriptionCapitalized =
    description.charAt(0).toUpperCase() + description.slice(1);

  const humidity = currentJson.main?.humidity ?? 0;
  const temp = currentJson.main?.temp ?? 0;
  const tempMin = currentJson.main?.temp_min ?? temp;
  const tempMax = currentJson.main?.temp_max ?? temp;
  const windMetersPerSecond = currentJson.wind?.speed ?? 0;
  const windKmH = Math.round(windMetersPerSecond * 3.6);

  const precipitationLabel = makePrecipitationLabel(forecastJson.list || []);

  const mainWeather = currentJson.weather?.[0]?.main || "Clear";
  const iconKind = pickWeatherIconKind([mainWeather]);

  return {
    cityName: `${currentJson.name}, ${currentJson.sys?.country ?? ""}`,
    description: descriptionCapitalized,
    dateTimeLabel: `${weekday}, ${hour}`,
    currentTemp: Math.round(temp),
    minTemp: Math.round(tempMin),
    maxTemp: Math.round(tempMax),
    precipitationLabel,
    humidityLabel: `Umidade: ${humidity}%`,
    windLabel: `Vento: ${windKmH} km/h`,
    iconKind,
    daily,
  };
};

/**
 * Usa API de geocoding para buscar sugestões de cidades (BR, sem duplicadas).
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<CitySuggestion[]>}
 */
const startFetchCitySuggestions = async (query, limit) => {
  const res = await fetch(buildGeoDirectUrl(query, limit));
  if (!res.ok) {
    throw new Error("Erro ao buscar sugestões");
  }
  const json = await res.json();

  /** @type {Record<string, CitySuggestion>} */
  const uniqueByName = {};

  json.forEach((place, index) => {
    if (place.country !== "BR") return;

    const name = place.name || "";
    const key = name.toLowerCase();
    if (!key) return;

    const label = `${name}${
      place.state ? ", " + place.state : ""
    }, ${place.country}`;

    const candidate = {
      id: `${place.lat}-${place.lon}-${index}`,
      label,
      lat: place.lat,
      lon: place.lon,
    };

    if (!uniqueByName[key]) {
      uniqueByName[key] = candidate;
    }
  });

  return Object.values(uniqueByName).slice(0, limit);
};

/**
 * Busca uma única cidade pela query (para quando o usuário aperta Enter).
 * @param {string} query
 * @returns {Promise<CitySuggestion|null>}
 */
const startSearchSingleCity = async (query) => {
  const suggestions = await startFetchCitySuggestions(query, 5);
  return suggestions[0] || null;
};

/**
 * Orquestra a chamada às APIs de clima usando coordenadas.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<CityWeather>}
 */
const startFetchWeatherByCoords = async (lat, lon) => {
  const [currentRes, forecastRes] = await Promise.all([
    fetch(buildCurrentWeatherUrlFromCoords(lat, lon)),
    fetch(buildForecastUrlFromCoords(lat, lon)),
  ]);

  if (!currentRes.ok) {
    throw new Error("Erro ao carregar clima atual");
  }
  if (!forecastRes.ok) {
    throw new Error("Erro ao carregar previsão");
  }

  const currentJson = await currentRes.json();
  const forecastJson = await forecastRes.json();

  return makeCityWeatherFromApi(currentJson, forecastJson);
};

/**
 * Renderiza um item de sugestão.
 * @param {{item: CitySuggestion, onPress: (s: CitySuggestion) => void}} props
 * @returns {JSX.Element}
 */
const SuggestionItem = ({ item, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(item)}
    style={styles.suggestionItem}
  >
    <MaterialIcons name="location-on" size={18} color="#e8eaed" />
    <Text style={styles.suggestionText}>{item.label}</Text>
  </TouchableOpacity>
);

/**
 * Barra de busca com autocomplete.
 * @param {{
 *  value: string,
 *  suggestions: CitySuggestion[],
 *  isSearching: boolean,
 *  onChangeText: (value: string) => void,
 *  onSubmit: () => void,
 *  onSelectSuggestion: (s: CitySuggestion) => void
 * }} props
 * @returns {JSX.Element}
 */
const SearchWithAutocomplete = ({
  value,
  suggestions,
  isSearching,
  onChangeText,
  onSubmit,
  onSelectSuggestion,
}) => (
  <View style={styles.searchWrapper}>
    <View style={styles.searchBar}>
      <MaterialIcons
        name="search"
        size={20}
        color="#9aa0a6"
        style={styles.searchIcon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Maricá"
        placeholderTextColor="#9aa0a6"
        style={styles.searchInput}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {isSearching && (
        <ActivityIndicator
          size="small"
          color="#9aa0a6"
          style={styles.searchLoadingIcon}
        />
      )}
    </View>

    {suggestions.length > 0 && (
      <View style={styles.suggestionContainer}>
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={suggestions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SuggestionItem item={item} onPress={onSelectSuggestion} />
          )}
        />
      </View>
    )}
  </View>
);

/**
 * Ícone grande do cabeçalho (sol / nuvens / nuvens com chuva).
 * @param {{kind: "sun"|"cloud"|"rain"}} props
 * @returns {JSX.Element}
 */
const CurrentWeatherIcon = ({ kind }) => {
  if (kind === "rain") {
    // nuvens com chuva
    return <FontAwesome5 name="cloud-rain" size={44} color="#8ab4f8" />;
  }
  if (kind === "cloud") {
    // apenas nuvens
    return <MaterialIcons name="wb-cloudy" size={44} color="#e8eaed" />;
  }
  // ensolarado
  return <MaterialIcons name="wb-sunny" size={44} color="#fbbc04" />;
};

/**
 * Cabeçalho com temperatura atual (layout bem próximo ao do Google).
 * @param {{weather: CityWeather}} props
 * @returns {JSX.Element}
 */
const WeatherHeaderCard = ({ weather }) => (
  <View style={styles.headerCard}>
    <View style={styles.headerMainRow}>
      {/* Lado esquerdo */}
      <View style={styles.headerLeft}>
        <View style={styles.tempRow}>
          <CurrentWeatherIcon kind={weather.iconKind} />
          <Text style={styles.currentTempText}>{weather.currentTemp}</Text>
          <Text style={styles.currentUnitText}>°C</Text>
        </View>

        <View style={styles.metaColumn}>
          <Text style={styles.metaText}>{weather.precipitationLabel}</Text>
          <Text style={styles.metaText}>{weather.humidityLabel}</Text>
          <Text style={styles.metaText}>{weather.windLabel}</Text>
        </View>
      </View>

      {/* Lado direito */}
      <View style={styles.headerRight}>
        <Text style={styles.climaTitle}>Clima</Text>
        <Text style={styles.dateTimeTextRight}>{weather.dateTimeLabel}</Text>
        <Text style={styles.descriptionTextRight}>{weather.description}</Text>
      </View>
    </View>
  </View>
);

/**
 * Ícone de condição diária (sol / nuvens / nuvens com chuva).
 * @param {{kind: "sun"|"cloud"|"rain"}} props
 * @returns {JSX.Element}
 */
const DailyIcon = ({ kind }) => {
  if (kind === "rain") {
    return <FontAwesome5 name="cloud-rain" size={22} color="#8ab4f8" />;
  }
  if (kind === "cloud") {
    return <MaterialIcons name="wb-cloudy" size={22} color="#e8eaed" />;
  }
  return <MaterialIcons name="wb-sunny" size={22} color="#fbbc04" />;
};

/**
 * Linha com os dias da semana e mín/máx (card centralizado).
 * @param {{days: WeatherDay[]}} props
 * @returns {JSX.Element|null}
 */
const DailyForecastRow = ({ days }) => {
  if (!days || days.length === 0) return null;

  return (
    <View style={styles.dailyWrapper}>
      <View style={styles.dailyRow}>
        {days.map((day, index) => (
          <View
            key={`${day.weekDayLabel}-${index}`}
            style={[
              styles.dailyItem,
              index === 0 && styles.dailyItemActive, // hoje destacado
            ]}
          >
            <Text style={styles.dailyWeekDayText}>{day.weekDayLabel}</Text>
            <DailyIcon kind={day.icon} />
            <Text style={styles.dailyTempText}>
              {day.max}° {day.min}°
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

/**
 * Configuração visual dos toasts.
 */
const toastConfig = {
  success: ({ text1, text2 }) => (
    <View style={styles.toastSuccessContainer}>
      <View style={styles.toastAccentSuccess} />
      <View style={styles.toastTextWrapper}>
        <Text style={styles.toastTitle}>{text1}</Text>
        {text2 ? <Text style={styles.toastSubtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }) => (
    <View style={styles.toastErrorContainer}>
      <View style={styles.toastAccentError} />
      <View style={styles.toastTextWrapper}>
        <Text style={styles.toastTitle}>{text1}</Text>
        {text2 ? <Text style={styles.toastSubtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
};

/**
 * Tela principal.
 * @returns {JSX.Element}
 */
export default function App() {
  const [searchText, setSearchText] = React.useState("Maricá");
  const [suggestions, setSuggestions] = React.useState(
    /** @type {CitySuggestion[]} */ ([]),
  );
  const [weather, setWeather] = React.useState(
    /** @type {CityWeather|null} */ (null),
  );
  const [weatherLoading, setWeatherLoading] = React.useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  /**
   * Atualiza sugestões quando o texto muda.
   * @param {string} value
   * @returns {Promise<void>}
   */
  const startUpdateSuggestions = async (value) => {
    const query = value.trim();

    if (query.length < 3) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    try {
      const next = await startFetchCitySuggestions(query, 5);
      setSuggestions(next);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  /**
   * Handler de mudança de texto da busca.
   * @param {string} value
   * @returns {void}
   */
  const handleChangeSearchText = (value) => {
    setSearchText(value);
    startUpdateSuggestions(value);
  };

  /**
   * Handler quando o usuário escolhe uma cidade na lista.
   * @param {CitySuggestion} suggestion
   * @returns {Promise<void>}
   */
  const handleSelectSuggestion = async (suggestion) => {
    setSearchText(suggestion.label);
    setSuggestions([]);
    setWeatherLoading(true);
    setErrorMessage("");

    try {
      const result = await startFetchWeatherByCoords(
        suggestion.lat,
        suggestion.lon,
      );
      setWeather(result);
      showToast("success", "Clima atualizado", suggestion.label);
    } catch (error) {
      const msg = "Não foi possível carregar o clima para essa cidade.";
      setErrorMessage(msg);
      showToast("error", "Erro ao carregar clima", msg);
    } finally {
      setWeatherLoading(false);
    }
  };

  /**
   * Handler quando o usuário aperta "Search" no teclado.
   * @returns {Promise<void>}
   */
  const handleSubmitSearch = async () => {
    const query = searchText.trim();
    if (!query) return;

    setWeatherLoading(true);
    setErrorMessage("");
    setSuggestions([]);

    try {
      const city = await startSearchSingleCity(query);

      if (!city) {
        const msg = "Cidade não encontrada.";
        setWeather(null);
        setErrorMessage(msg);
        showToast("error", "Erro ao carregar clima", msg);
        return;
      }

      const result = await startFetchWeatherByCoords(city.lat, city.lon);
      setWeather(result);
      showToast("success", "Clima atualizado", city.label);
    } catch (error) {
      const msg = "Não foi possível carregar o clima para essa cidade.";
      setErrorMessage(msg);
      showToast("error", "Erro ao carregar clima", msg);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Carrega clima inicial
  React.useEffect(() => {
    handleSubmitSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSearching = suggestionsLoading || weatherLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <SearchWithAutocomplete
          value={searchText}
          suggestions={suggestions}
          isSearching={isSearching}
          onChangeText={handleChangeSearchText}
          onSubmit={handleSubmitSearch}
          onSelectSuggestion={handleSelectSuggestion}
        />

        {weatherLoading && !weather && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#8ab4f8" />
            <Text style={styles.loadingText}>Carregando dados de clima...</Text>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.errorWrapper}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {weather && (
          <>
            <WeatherHeaderCard weather={weather} />
            <DailyForecastRow days={weather.daily} />
          </>
        )}
      </ScrollView>

      <Toast config={toastConfig} topOffset={40} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#202124",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  // search
  searchWrapper: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3c4043",
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: "#e8eaed",
    fontSize: 16,
    paddingVertical: 4,
  },
  searchLoadingIcon: {
    marginLeft: 6,
  },
  suggestionContainer: {
    marginTop: 6,
    backgroundColor: "#303134",
    borderRadius: 12,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: {
    marginLeft: 6,
    color: "#e8eaed",
    fontSize: 14,
  },
  // header card
  headerCard: {
    backgroundColor: "#303134",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "column",
  },
  tempRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  currentTempText: {
    fontSize: 52,
    color: "#e8eaed",
    fontWeight: "400",
    marginLeft: 6,
  },
  currentUnitText: {
    fontSize: 18,
    color: "#e8eaed",
    marginLeft: 2,
    marginTop: 8,
  },
  metaColumn: {
    marginTop: 8,
  },
  metaText: {
    color: "#9aa0a6",
    fontSize: 13,
  },
  headerRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  climaTitle: {
    color: "#e8eaed",
    fontSize: 22,
  },
  dateTimeTextRight: {
    color: "#e8eaed",
    fontSize: 14,
    marginTop: 4,
  },
  descriptionTextRight: {
    color: "#e8eaed",
    fontSize: 14,
    marginTop: 2,
  },
  // loading & error
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 8,
    color: "#9aa0a6",
    fontSize: 13,
  },
  errorWrapper: {
    backgroundColor: "#3c4043",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#f28b82",
    fontSize: 13,
  },
  // daily forecast
  dailyWrapper: {
    alignItems: "center",
  },
  dailyRow: {
    backgroundColor: "#303134",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  dailyItem: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  dailyItemActive: {
    backgroundColor: "#3c4043",
    borderRadius: 12,
  },
  dailyWeekDayText: {
    color: "#e8eaed",
    fontSize: 13,
    marginBottom: 4,
  },
  dailyTempText: {
    color: "#e8eaed",
    fontSize: 12,
    marginTop: 4,
  },
  // toasts
  toastSuccessContainer: {
    flexDirection: "row",
    backgroundColor: "#202124",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: "80%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  toastErrorContainer: {
    flexDirection: "row",
    backgroundColor: "#202124",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: "80%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  toastAccentSuccess: {
    width: 4,
    borderRadius: 4,
    backgroundColor: "#34a853",
    marginRight: 8,
  },
  toastAccentError: {
    width: 4,
    borderRadius: 4,
    backgroundColor: "#ea4335",
    marginRight: 8,
  },
  toastTextWrapper: {
    flex: 1,
  },
  toastTitle: {
    color: "#e8eaed",
    fontWeight: "bold",
    fontSize: 14,
  },
  toastSubtitle: {
    color: "#9aa0a6",
    fontSize: 13,
    marginTop: 2,
  },
});
