import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import InAppToast from '../components/InAppToast';

// A Dynamic Island inset, which is where the bug showed: 59 plus padding
// already exceeded the old fixed -100 hide offset before the toast's own
// height was counted at all, leaving a third of the banner above the status bar.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));

const MESSAGE = 'New version available';

describe('InAppToast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders nothing at all while hidden', async () => {
    // The guarantee that makes the sliver impossible: not "moved far enough
    // up", but "not on screen".
    await render(<InAppToast message={MESSAGE} visible={false} onDismiss={jest.fn()} />);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('shows the message when visible', async () => {
    await render(<InAppToast message={MESSAGE} visible onDismiss={jest.fn()} />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  it('unmounts once the hide animation finishes', async () => {
    await render(<InAppToast message={MESSAGE} visible onDismiss={jest.fn()} />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();

    await screen.rerender(<InAppToast message={MESSAGE} visible={false} onDismiss={jest.fn()} />);
    await act(async () => { jest.advanceTimersByTime(2000); });

    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('times out into onDismiss, which is not a user decision', async () => {
    const onDismiss = jest.fn();
    const onClose = jest.fn();
    await render(
      <InAppToast message={MESSAGE} visible onDismiss={onDismiss} onClose={onClose} closeLabel="Close" />,
    );

    await act(async () => { jest.advanceTimersByTime(4000); });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    // Timing out must never be reported as the user closing it: the update
    // banner remembers a close for that version forever.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose only when the user actually taps the ×', async () => {
    const onDismiss = jest.fn();
    const onClose = jest.fn();
    await render(
      <InAppToast
        message={MESSAGE}
        visible
        onDismiss={onDismiss}
        onClose={onClose}
        closeLabel="Close"
        actionLabel="Update"
        onAction={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows no × when the caller has no use for one', async () => {
    await render(<InAppToast message="Saved" visible onDismiss={jest.fn()} closeLabel="Close" />);
    expect(screen.queryByLabelText('Close')).toBeNull();
  });
});

describe('InAppToast — nothing to say', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // Callers drive visibility from truthiness (`visible={!!toastMessage}`), and
  // a blank string passes that check while rendering no text — which is what
  // put an empty card with a lone error icon above the menu categories.
  it.each([
    ['an empty message', ''],
    ['a whitespace-only message', '   '],
    ['a newline', '\n'],
  ])('renders no card for %s, even when told it is visible', async (_label, message) => {
    await render(<InAppToast message={message} type="error" visible onDismiss={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('clears the caller so a blank message cannot get stuck', async () => {
    const onDismiss = jest.fn();
    await render(<InAppToast message="   " visible onDismiss={onDismiss} />);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('still shows a message that is merely padded', async () => {
    await render(<InAppToast message="  Saved  " visible onDismiss={jest.fn()} />);
    expect(screen.getByText('  Saved  ')).toBeTruthy();
  });
});
