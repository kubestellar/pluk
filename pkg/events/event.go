package events

import (
	"encoding/json"
	"fmt"
	"time"
)

type Event struct {
	Version int               `json:"v"`
	TS      string            `json:"ts"`
	Seq     int               `json:"seq"`
	PID     int               `json:"pid"`
	Session string            `json:"session"`
	Pane    string            `json:"pane"`
	Source  string            `json:"source"`
	Type    string            `json:"type"`
	Data    map[string]string `json:"data"`
}

func New(session, pane, source string, seq int, eventType string, data map[string]string) Event {
	return Event{
		Version: 1,
		TS:      time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		Seq:     seq,
		PID:     0,
		Session: session,
		Pane:    pane,
		Source:  source,
		Type:    eventType,
		Data:    data,
	}
}

func (e Event) JSON() string {
	b, err := json.Marshal(e)
	if err != nil {
		return fmt.Sprintf(`{"error":%q}`, err.Error())
	}
	return string(b)
}
