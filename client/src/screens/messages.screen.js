import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  View,
} from 'react-native';
import React, { Component } from 'react';
import randomColor from 'randomcolor';
import { graphql, compose } from 'react-apollo';
import PropTypes from 'prop-types';
import Message from '../components/message.component';
import MessageInput from '../components/message-input.component';
import GROUP_QUERY from '../graphql/group.query';
import CREATE_MESSAGE_MUTATION from '../graphql/create-message.mutation';

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    backgroundColor: '#e5ddd5',
    flex: 1,
    flexDirection: 'column',
  },
  loading: {
    justifyContent: 'center',
  },
});

function isDuplicateMessage(newMessage, existingMessages) {
  return newMessage.id !== null &&
    existingMessages.some(message => newMessage.id === message.id);
}

class Messages extends Component {
  static navigationOptions = ({ navigation }) => {
    const { state } = navigation;
    return {
      title: state.params.title,
    };
  };
  constructor(props) {
    super(props);
    this.state = {
      usernameColors: {},
    };
    this.send = this.send.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    const usernameColors = {};
    // check for new messages
    if (nextProps.group) {
      if (nextProps.group.users) {
        // apply a color to each user
        nextProps.group.users.forEach((user) => {
          usernameColors[user.username] = this.state.usernameColors[user.username] || randomColor();
        });
      }
      this.setState({
        usernameColors,
      });
    }
  }
  send = (text) => {
    this.props.createMessage({
      groupId: this.props.navigation.state.params.groupId,
      userId: 1, // faking the user for now
      text,
    }).then(() => {
      this.flatList.scrollToEnd({ animated: true });
    });
  }
  keyExtractor = item => item.id;
  renderItem = ({ item: message }) => (
    <Message
      color={this.state.usernameColors[message.from.username]}
      isCurrentUser={message.from.id === 1} // for now until we implement auth
      message={message}
    />
  )
  render() {
    const { loading, group } = this.props;
    // render loading placeholder while we fetch messages
    if (loading && !group) {
      return (
        <View style={[styles.loading, styles.container]}>
          <ActivityIndicator />
        </View>
      );
    }
    // render list of messages for group
    return (
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior="position"
          contentContainerStyle={styles.container}
          keyboardVerticalOffset={64}
          style={styles.container}
        >
          <FlatList
            data={group.messages.slice().reverse()}
            keyExtractor={this.keyExtractor}
            renderItem={this.renderItem}
            ref={(ref) => { this.flatList = ref; }}
          />
        </KeyboardAvoidingView>
        <MessageInput send={this.send} />
      </View>
    );
  }
}

Messages.propTypes = {
  createMessage: PropTypes.func,
  navigation: PropTypes.shape({
    state: PropTypes.shape({
      params: PropTypes.shape({
        groupId: PropTypes.number,
      }),
    }),
  }),
  group: PropTypes.shape({
    messages: PropTypes.array,
    users: PropTypes.array,
  }),
  loading: PropTypes.bool,
};
const groupQuery = graphql(GROUP_QUERY, {
  options: ownProps => ({
    variables: {
      groupId: ownProps.navigation.state.params.groupId,
    },
  }),
  props: ({ data: { loading, group } }) => ({
    loading, group,
  }),
});
/* eslint-disable consistent-return */
const createMessageMutation = graphql(CREATE_MESSAGE_MUTATION, {
  props: ({ mutate }) => ({
    createMessage: ({ text, userId, groupId }) =>
      mutate({
        variables: { text, userId, groupId },
        optimisticResponse: {
          __typename: 'Mutation',
          createMessage: {
            __typename: 'Message',
            id: -1, // don't know id yet, but it doesn't matter
            text, // we know what the text will be
            createdAt: new Date().toISOString(), // the time is now!
            from: {
              __typename: 'User',
              id: 1, // still faking the user
              username: 'Justyn.Kautzer', // still faking the user
            },
            to: {
              __typename: 'Group',
              id: groupId,
            },
          },
        },
        update: (store, { data: { createMessage } }) => {
          // Read the data from our cache for this query.
          const data = store.readQuery({
            query: GROUP_QUERY,
            variables: {
              groupId,
            },
          });
          if (isDuplicateMessage(createMessage, data.group.messages)) {
            return data;
          }
          // Add our message from the mutation to the end.
          data.group.messages.unshift(createMessage);
          // Write our data back to the cache.
          store.writeQuery({
            query: GROUP_QUERY,
            variables: {
              groupId,
            },
            data,
          });
        },
      }),
  }),
});
export default compose(groupQuery, createMessageMutation)(Messages);
