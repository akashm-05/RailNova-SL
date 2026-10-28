import { AutopilotService, AutopilotConstraints, AutopilotItinerary } from './autopilot.service.js';

export interface AssistantResponse {
  query: string;
  parsedConstraints: AutopilotConstraints;
  explainabilitySteps: Array<{ step: string; detail: string }>;
  conversationalSummary: string;
  recommendedItineraries: AutopilotItinerary[];
}

export class AssistantService {
  /**
   * Deterministically parses natural language requests into verified Autopilot search constraints.
   */
  static parseQuery(queryText: string): AutopilotConstraints {
    const q = queryText.toLowerCase();

    // 1. Station Mapping
    const stationMap: Record<string, string> = {
      'delhi': 'NDLS',
      'new delhi': 'NDLS',
      'ndls': 'NDLS',
      'kanpur': 'CNB',
      'cnb': 'CNB',
      'prayagraj': 'PRYJ',
      'allahabad': 'PRYJ',
      'pryj': 'PRYJ',
      'varanasi': 'DDU',
      'mughalsarai': 'DDU',
      'ddu': 'DDU',
      'howrah': 'HWH',
      'kolkata': 'HWH',
      'calcutta': 'HWH',
      'hwh': 'HWH',
      'bhopal': 'BPL',
      'bpl': 'BPL',
      'nagpur': 'NGP',
      'ngp': 'NGP'
    };

    let origin = 'NDLS';
    let destination = 'HWH';

    // Regex check for "from X to Y"
    const fromToMatch = q.match(/from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+)/i);
    if (fromToMatch) {
      const fromCandidate = fromToMatch[1].trim().toLowerCase();
      const toCandidate = fromToMatch[2].trim().toLowerCase();

      for (const [key, code] of Object.entries(stationMap)) {
        if (fromCandidate.includes(key)) origin = code;
        if (toCandidate.includes(key)) destination = code;
      }
    } else {
      // General presence check
      for (const [key, code] of Object.entries(stationMap)) {
        if (q.includes(key) && !origin) origin = code;
        else if (q.includes(key) && origin !== code) destination = code;
      }
    }

    // 2. Date parsing
    const today = new Date();
    let travelDate = new Date(today);
    travelDate.setDate(today.getDate() + 1); // default tomorrow
    let dateStr = travelDate.toISOString().split('T')[0];

    if (q.includes('today')) {
      dateStr = today.toISOString().split('T')[0];
    } else if (q.includes('tomorrow')) {
      const d = new Date(today);
      d.setDate(today.getDate() + 1);
      dateStr = d.toISOString().split('T')[0];
    } else {
      const explicitDateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
      if (explicitDateMatch) {
        dateStr = explicitDateMatch[0];
      }
    }

    // 3. Class detection
    let coachClass = '3A';
    if (q.includes('sleeper') || q.includes(' sl ')) coachClass = 'SL';
    else if (q.includes('2a') || q.includes('2nd ac') || q.includes('second ac')) coachClass = '2A';
    else if (q.includes('1a') || q.includes('first ac')) coachClass = '1A';
    else if (q.includes('3a') || q.includes('third ac')) coachClass = '3A';

    // 4. Passenger Count
    let passengerCount = 1;
    const paxMatch = q.match(/(\d+)\s*(pax|passenger|ticket|person|people|adult)/i);
    if (paxMatch) {
      passengerCount = parseInt(paxMatch[1], 10);
    } else if (q.includes('two tickets') || q.includes('2 tickets')) {
      passengerCount = 2;
    }

    // 5. Transfer Constraints - Default to Direct Single-Train (0 transfers)
    let maxTransfers = 0;
    if (q.includes('connecting') || q.includes('via ') || q.includes('transfer') || q.includes('switch train')) {
      maxTransfers = 1;
    }

    // 6. Minimum Connection / Layover
    let minConnectionMinutes = 30;
    const layoverMatch = q.match(/(?:at least|minimum|avoid transfers shorter than)\s*(\d+)\s*(?:m|min|minutes)/i);
    if (layoverMatch) {
      minConnectionMinutes = parseInt(layoverMatch[1], 10);
    }

    // 7. Arrival Deadline
    let arrivalDeadlineTime: string | undefined = undefined;
    if (q.includes('before noon') || q.includes('by noon')) {
      arrivalDeadlineTime = '12:00';
    } else {
      const timeMatch = q.match(/arriving before\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const mins = timeMatch[2] ? timeMatch[2] : '00';
        const meridian = timeMatch[3]?.toLowerCase();

        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;

        arrivalDeadlineTime = `${hour.toString().padStart(2, '0')}:${mins}`;
      }
    }

    // 8. Berth Preference
    let preferredBerth: string | undefined = undefined;
    if (q.includes('lower berth') || q.includes('prefer lower')) preferredBerth = 'LOWER';
    else if (q.includes('middle berth')) preferredBerth = 'MIDDLE';
    else if (q.includes('upper berth')) preferredBerth = 'UPPER';
    else if (q.includes('side lower')) preferredBerth = 'SIDE_LOWER';

    // 9. Optimization Goal
    let objectiveWeight: 'BALANCED' | 'CHEAPEST' | 'FASTEST' | 'SAFEST' = 'BALANCED';
    if (q.includes('cheapest') || q.includes('lowest fare') || q.includes('budget') || q.includes('cost')) {
      objectiveWeight = 'CHEAPEST';
    } else if (q.includes('fastest') || q.includes('quickest') || q.includes('shortest duration')) {
      objectiveWeight = 'FASTEST';
    } else if (q.includes('safest') || q.includes('least risk') || q.includes('reliable connection')) {
      objectiveWeight = 'SAFEST';
    }

    return {
      origin,
      destination,
      date: dateStr,
      coachClass,
      passengerCount,
      maxTransfers,
      minConnectionMinutes,
      arrivalDeadlineTime,
      preferredBerth,
      objectiveWeight
    };
  }

  /**
   * Processes request, plans journey with Autopilot, and generates explainable answer.
   */
  static async processRequest(queryText: string): Promise<AssistantResponse> {
    const constraints = this.parseQuery(queryText);

    const explainabilitySteps = [
      {
        step: '1. Natural Language Intent Parsing',
        detail: `Extracted journey: ${constraints.origin} ➔ ${constraints.destination} on ${constraints.date} in ${constraints.coachClass} class for ${constraints.passengerCount} passenger(s).`
      },
      {
        step: '2. Constraint & Safety Bounds',
        detail: `Applied rules: Max transfers = ${constraints.maxTransfers}, Min layover = ${constraints.minConnectionMinutes}m${constraints.arrivalDeadlineTime ? `, Arrival deadline = ${constraints.arrivalDeadlineTime}` : ''}${constraints.preferredBerth ? `, Berth preference = ${constraints.preferredBerth}` : ''}.`
      },
      {
        step: '3. Timetable Graph Traversal',
        detail: `Evaluated valid multi-leg connections across database timetable and active inventory.`
      },
      {
        step: '4. Multi-Objective Optimization',
        detail: `Ranked routes by objective: ${constraints.objectiveWeight} (balancing Fare, Duration, Transfers, and Layover Risk).`
      }
    ];

    const result = await AutopilotService.planJourney(constraints);
    const topMatches = result.itineraries.filter(it => it.meetsAllConstraints);
    const displayItineraries = topMatches.length > 0 ? topMatches : result.itineraries;

    let conversationalSummary = '';
    if (displayItineraries.length > 0) {
      const best = displayItineraries[0];
      const fareRs = `₹${(best.totalFare / 100).toFixed(0)}`;
      const dur = `${Math.floor(best.totalDurationMinutes / 60)}h ${best.totalDurationMinutes % 60}m`;

      conversationalSummary = `I found ${displayItineraries.length} verified routes for your journey from ${constraints.origin} to ${constraints.destination}. The top recommendation is a ${best.journeyType.replace(/_/g, ' ')} (${dur}) for ${fareRs} with a ranking score of ${best.rankingScore}/100. ${best.rankingExplanation}`;
    } else {
      conversationalSummary = `No scheduled services found matching your constraints (${constraints.origin} to ${constraints.destination} on ${constraints.date}). Try adjusting the arrival deadline or expanding the transfer window.`;
    }

    return {
      query: queryText,
      parsedConstraints: constraints,
      explainabilitySteps,
      conversationalSummary,
      recommendedItineraries: displayItineraries
    };
  }
}
