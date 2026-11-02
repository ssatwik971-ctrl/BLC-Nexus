// Netlify Identity lifecycle hooks. New accounts are always least-privilege.
export default {
  userSignup(event) {
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...event.user.appMetadata,
          roles: ['member'],
        },
      },
    };
  },
};
