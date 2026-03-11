<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { LabeledInput } from '@components/Form/LabeledInput';
import FormValidation from '@shell/mixins/form-validation';

export default {
  emits: ['validationChanged', 'valueChanged'],

  components: { LabeledInput },
  mixins:     [CreateEditView, FormValidation],

  data() {
    return {
      fvFormRuleSets: [
        { path: 'decodedData.host', rules: ['required'] },
        { path: 'decodedData.token', rules: ['required'] },
      ]
    };
  },

  watch: {
    fvFormIsValid(newValue) {
      this.$emit('validationChanged', !!newValue);
    }
  },

  methods: {
    /**
     * Parse the user-provided host value into a hostname suitable
     * for the Rancher proxy path. Strips protocol and trailing
     * slashes.
     */
    proxyHost(host) {
      let h = (host || '').trim().replace(/\/+$/, '');

      if (h.startsWith('https://')) {
        h = h.slice('https://'.length);
      } else if (h.startsWith('http://')) {
        h = h.slice('http://'.length);
      }

      return h;
    },

    async test() {
      try {
        const host = this.proxyHost(
          this.value.decodedData.host
        );
        const token = this.value.decodedData.token;

        await this.$store.dispatch('management/request', {
          url:                  `/meta/proxy/${ host }/v1/ping`,
          headers:              {
            Accept:               'application/json',
            'x-api-auth-header':  `Bearer ${ token }`,
          },
          redirectUnauthorized: false,
        });

        return true;
      } catch (e) {
        return false;
      }
    }
  }
};
</script>

<template>
  <div>
    <LabeledInput
      :value="value.decodedData.host"
      label-key="cluster.cloudCredential.oxide.host.label"
      placeholder-key="cluster.cloudCredential.oxide.host.placeholder"
      :mode="mode"
      :required="true"
      :rules="fvGetAndReportPathRules('decodedData.host')"
      @update:value="$emit('valueChanged', 'host', $event)"
    />

    <div class="mt-20">
      <LabeledInput
        :value="value.decodedData.token"
        label-key="cluster.cloudCredential.oxide.token.label"
        placeholder-key="cluster.cloudCredential.oxide.token.placeholder"
        type="password"
        :mode="mode"
        :required="true"
        :rules="fvGetAndReportPathRules('decodedData.token')"
        @update:value="$emit('valueChanged', 'token', $event)"
      />
    </div>
  </div>
</template>
